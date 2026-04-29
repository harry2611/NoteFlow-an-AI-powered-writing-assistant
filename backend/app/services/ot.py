from pydantic import BaseModel


class TextOperation(BaseModel):
    type: str
    position: int
    text: str = ""
    length: int = 0
    version: int = 0


def transform_operation(incoming: TextOperation, applied: TextOperation) -> TextOperation:
    """Small OT transform for text insert/delete operations used by collaboration messages."""
    op = incoming.model_copy()
    if applied.type == "insert" and applied.position <= op.position:
        op.position += len(applied.text)
    if applied.type == "delete" and applied.position < op.position:
        op.position = max(applied.position, op.position - applied.length)
    return op

