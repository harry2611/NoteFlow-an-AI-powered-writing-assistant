from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket


@dataclass
class Connection:
    websocket: WebSocket
    user_id: str
    name: str
    avatar_color: str


@dataclass
class Room:
    connections: dict[str, Connection] = field(default_factory=dict)
    version: int = 0
    history: list[dict[str, Any]] = field(default_factory=list)


class CollaborationManager:
    def __init__(self) -> None:
        self.rooms: dict[str, Room] = defaultdict(Room)

    async def connect(self, document_id: str, connection_id: str, connection: Connection) -> None:
        await connection.websocket.accept()
        room = self.rooms[document_id]
        room.connections[connection_id] = connection
        await self.broadcast(
            document_id,
            {
                "type": "user_joined",
                "user": self._public_user(connection_id, connection),
                "users": self.users(document_id),
                "version": room.version,
            },
        )

    async def disconnect(self, document_id: str, connection_id: str) -> None:
        room = self.rooms.get(document_id)
        if not room:
            return
        connection = room.connections.pop(connection_id, None)
        if connection:
            await self.broadcast(
                document_id,
                {
                    "type": "user_left",
                    "user": self._public_user(connection_id, connection),
                    "users": self.users(document_id),
                    "version": room.version,
                },
            )
        if not room.connections:
            self.rooms.pop(document_id, None)

    async def handle_message(self, document_id: str, sender_id: str, payload: dict[str, Any]) -> None:
        room = self.rooms[document_id]
        if payload.get("type") in {"block_update", "cursor"}:
            room.version += 1
            payload["version"] = room.version
        if payload.get("type") == "block_update":
            room.history.append(payload)
            room.history = room.history[-100:]
        await self.broadcast(document_id, payload, exclude=sender_id)

    async def broadcast(self, document_id: str, payload: dict[str, Any], exclude: str | None = None) -> None:
        room = self.rooms.get(document_id)
        if not room:
            return
        stale: list[str] = []
        for connection_id, connection in room.connections.items():
            if connection_id == exclude:
                continue
            try:
                await connection.websocket.send_json(payload)
            except RuntimeError:
                stale.append(connection_id)
        for connection_id in stale:
            room.connections.pop(connection_id, None)

    def users(self, document_id: str) -> list[dict[str, str]]:
        room = self.rooms.get(document_id)
        if not room:
            return []
        return [
            self._public_user(connection_id, connection)
            for connection_id, connection in room.connections.items()
        ]

    def _public_user(self, connection_id: str, connection: Connection) -> dict[str, str]:
        return {
            "connection_id": connection_id,
            "id": connection.user_id,
            "name": connection.name,
            "avatar_color": connection.avatar_color,
        }


collaboration_manager = CollaborationManager()
