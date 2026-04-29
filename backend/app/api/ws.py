from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.deps import user_from_token
from app.db.session import SessionLocal
from app.services.collaboration import Connection, collaboration_manager


router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{document_id}")
async def websocket_document(websocket: WebSocket, document_id: str) -> None:
    token = websocket.query_params.get("token", "")
    async with SessionLocal() as session:
        user = await user_from_token(token, session)
    if not user:
        await websocket.close(code=4401)
        return

    connection_id = str(uuid4())
    await collaboration_manager.connect(
        document_id,
        connection_id,
        Connection(websocket=websocket, user_id=user.id, name=user.name, avatar_color=user.avatar_color),
    )
    try:
        while True:
            payload = await websocket.receive_json()
            payload.setdefault("sender", connection_id)
            await collaboration_manager.handle_message(document_id, connection_id, payload)
    except WebSocketDisconnect:
        await collaboration_manager.disconnect(document_id, connection_id)

