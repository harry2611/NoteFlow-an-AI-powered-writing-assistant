from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models.user import User
from app.schemas.search import IndexRequest, SearchQuery, SearchResult
from app.services.document_indexer import get_document_for_user, index_document, semantic_search


router = APIRouter(prefix="/search", tags=["search"])


@router.post("/index")
async def index(payload: IndexRequest, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    document = await get_document_for_user(session, payload.document_id, current_user.id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    count = await index_document(session, document)
    return {"indexed_chunks": count}


@router.post("/query", response_model=list[SearchResult])
async def query(payload: SearchQuery, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    rows = await semantic_search(session, payload.query, current_user.id, payload.limit)
    return rows

