from typing import Any

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, DocumentChunk
from app.services.openai_service import openai_service


def extract_text_blocks(content_json: dict[str, Any]) -> list[str]:
    blocks = content_json.get("content", [])
    chunks: list[str] = []
    for block in blocks:
        block_type = block.get("type")
        if block_type == "horizontalRule":
            continue
        text_value = _text_from_node(block).strip()
        if text_value:
            chunks.append(text_value)
    return chunks


def _text_from_node(node: dict[str, Any]) -> str:
    parts: list[str] = []
    if "text" in node:
        parts.append(str(node["text"]))
    for child in node.get("content", []) or []:
        parts.append(_text_from_node(child))
    return " ".join(part for part in parts if part)


async def index_document(session: AsyncSession, document: Document) -> int:
    chunks = extract_text_blocks(document.content_json or {})
    await session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
    if not chunks:
        await session.commit()
        return 0

    embeddings = await openai_service.embed(chunks)
    for index, (chunk, embedding) in enumerate(zip(chunks, embeddings, strict=True)):
        session.add(
            DocumentChunk(
                document_id=document.id,
                chunk_text=chunk,
                embedding=embedding,
                chunk_index=index,
            )
        )
    await session.commit()
    return len(chunks)


async def semantic_search(session: AsyncSession, query: str, user_id: str, limit: int = 5) -> list[dict[str, Any]]:
    embedding = (await openai_service.embed([query]))[0]
    embedding_value = "[" + ",".join(str(value) for value in embedding) + "]"
    sql = text(
        """
        SELECT
          c.document_id,
          d.title AS document_title,
          c.chunk_index,
          c.chunk_text,
          d.content_json,
          1 - (c.embedding <=> CAST(:embedding AS vector)) AS score
        FROM document_chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE d.user_id = :user_id
        ORDER BY c.embedding <=> CAST(:embedding AS vector)
        LIMIT :limit
        """
    )
    rows = await session.execute(sql, {"embedding": embedding_value, "limit": limit, "user_id": user_id})
    return [dict(row._mapping) for row in rows]


async def get_document_for_user(session: AsyncSession, document_id: str, user_id: str) -> Document | None:
    result = await session.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    return result.scalar_one_or_none()
