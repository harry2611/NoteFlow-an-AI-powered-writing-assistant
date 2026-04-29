from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentCreate, DocumentListItem, DocumentOut, DocumentUpdate
from app.services.document_indexer import index_document


router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def create_document(
    payload: DocumentCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Document:
    document = Document(user_id=current_user.id, title=payload.title, content_json=payload.content_json)
    session.add(document)
    await session.commit()
    await session.refresh(document)
    await index_document(session, document)
    return document


@router.get("", response_model=list[DocumentListItem])
async def list_documents(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[Document]:
    result = await session.execute(
        select(Document).where(Document.user_id == current_user.id).order_by(Document.updated_at.desc())
    )
    return list(result.scalars())


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Document:
    document = await _get_owned_document(session, document_id, current_user.id)
    return document


@router.put("/{document_id}", response_model=DocumentOut)
async def update_document(
    document_id: str,
    payload: DocumentUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Document:
    document = await _get_owned_document(session, document_id, current_user.id)
    if payload.title is not None:
        document.title = payload.title
    if payload.content_json is not None:
        document.content_json = payload.content_json
    await session.commit()
    await session.refresh(document)
    await index_document(session, document)
    await session.refresh(document)
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    document = await _get_owned_document(session, document_id, current_user.id)
    await session.delete(document)
    await session.commit()


async def _get_owned_document(session: AsyncSession, document_id: str, user_id: str) -> Document:
    result = await session.execute(select(Document).where(Document.id == document_id, Document.user_id == user_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document

