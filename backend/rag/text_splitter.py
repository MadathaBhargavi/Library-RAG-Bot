from typing import List, Dict, Any

class RecursiveTextSplitter:
    """Splits large texts recursively into smaller chunks using separator priority."""

    def __init__(self, chunk_size: int = 600, chunk_overlap: int = 100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = ["\n\n", "\n", ". ", "? ", "! ", " ", ""]

    def split_section(self, section: Dict[str, Any]) -> List[Dict[str, Any]]:
        text = section["text"]
        metadata = section["metadata"]

        if len(text) <= self.chunk_size:
            return [{
                "text": text,
                "metadata": metadata
            }]

        chunks = self._recursive_split(text)
        result_chunks = []
        for idx, c in enumerate(chunks):
            chunk_meta = metadata.copy()
            chunk_meta["chunk_index"] = idx
            result_chunks.append({
                "text": c,
                "metadata": chunk_meta
            })
        return result_chunks

    def _recursive_split(self, text: str) -> List[str]:
        if len(text) <= self.chunk_size:
            return [text]

        # Find best separator
        separator = ""
        for sep in self.separators:
            if sep in text:
                separator = sep
                break

        if not separator:
            # Fallback: slice by characters
            chunks = []
            start = 0
            while start < len(text):
                end = min(start + self.chunk_size, len(text))
                chunks.append(text[start:end])
                start += self.chunk_size - self.chunk_overlap
            return chunks

        parts = text.split(separator)
        final_chunks = []
        current_chunk = ""

        for part in parts:
            candidate = current_chunk + (separator if current_chunk else "") + part
            if len(candidate) <= self.chunk_size:
                current_chunk = candidate
            else:
                if current_chunk:
                    final_chunks.append(current_chunk)
                    # Maintain overlap from current_chunk end
                    overlap_start = max(0, len(current_chunk) - self.chunk_overlap)
                    current_chunk = current_chunk[overlap_start:] + (separator if current_chunk[overlap_start:] else "") + part
                else:
                    # Single part exceeds chunk_size, split sub-part recursively
                    sub_chunks = self._recursive_split(part)
                    final_chunks.extend(sub_chunks[:-1])
                    current_chunk = sub_chunks[-1] if sub_chunks else ""

        if current_chunk.strip():
            final_chunks.append(current_chunk.strip())

        return [c for c in final_chunks if c.strip()]
