import os
import re
from pathlib import Path
from typing import List, Dict, Any
from pypdf import PdfReader
from docx import Document as DocxDocument

class DocumentLoader:
    """Handles text extraction from PDF, DOCX, TXT, and Markdown files."""

    @staticmethod
    def load_document(file_path: Path) -> List[Dict[str, Any]]:
        """
        Loads a document file and returns a list of dictionary sections with content and metadata.
        Output format per item:
        {
            "text": str,
            "metadata": {
                "source": str (filename),
                "file_type": str,
                "section": str,
                "page": Optional[int]
            }
        }
        """
        path = Path(file_path)
        ext = path.suffix.lower()
        filename = path.name

        if ext == ".pdf":
            return DocumentLoader._load_pdf(path, filename)
        elif ext == ".docx":
            return DocumentLoader._load_docx(path, filename)
        elif ext in [".txt", ".md"]:
            return DocumentLoader._load_text(path, filename, ext)
        elif ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp"]:
            return DocumentLoader._load_image(path, filename)
        else:
            raise ValueError(f"Unsupported document format: {ext}")

    @staticmethod
    def _load_image(path: Path, filename: str) -> List[Dict[str, Any]]:
        sections = []
        extracted_text = ""
        try:
            from PIL import Image
            img = Image.open(path)
            
            # Try pytesseract OCR if installed
            try:
                import pytesseract
                extracted_text = pytesseract.image_to_string(img)
            except Exception as ocr_err:
                print(f"[OCR Notice]: pytesseract unavailable, using fallback text: {ocr_err}")
                extracted_text = f"Image content from {filename}. (Visual document/book screenshot: Width={img.width}px, Height={img.height}px, Format={img.format})"
        except Exception as e:
            print(f"[Error reading image {filename}]: {e}")
            extracted_text = f"Image file: {filename}"

        sections.append({
            "text": extracted_text.strip() or f"Image file {filename}",
            "metadata": {
                "source": filename,
                "file_type": "IMAGE",
                "section": "Screenshot OCR / Book Image",
                "page": 1
            }
        })
        return sections

    @staticmethod
    def _load_pdf(path: Path, filename: str) -> List[Dict[str, Any]]:
        sections = []
        try:
            reader = PdfReader(str(path))
            current_section = "General"
            
            for idx, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                text = text.strip()
                if not text:
                    continue
                
                # Check for headings on page
                lines = text.split("\n")
                first_line = lines[0].strip() if lines else ""
                if first_line and len(first_line) < 60 and not first_line.endswith("."):
                    current_section = first_line

                sections.append({
                    "text": text,
                    "metadata": {
                        "source": filename,
                        "file_type": "PDF",
                        "section": current_section,
                        "page": idx + 1
                    }
                })
        except Exception as e:
            print(f"[Error reading PDF {filename}]: {e}")
        return sections

    @staticmethod
    def _load_docx(path: Path, filename: str) -> List[Dict[str, Any]]:
        sections = []
        try:
            doc = DocxDocument(str(path))
            current_section = "General Information"
            buffer = []

            for p in doc.paragraphs:
                text = p.text.strip()
                if not text:
                    continue

                if p.style and ("Heading" in p.style.name or text.startswith(("1.", "2.", "3.", "4.", "5."))) and len(text) < 80:
                    if buffer:
                        sections.append({
                            "text": "\n".join(buffer),
                            "metadata": {
                                "source": filename,
                                "file_type": "DOCX",
                                "section": current_section,
                                "page": None
                            }
                        })
                        buffer = []
                    current_section = text
                else:
                    buffer.append(text)

            if buffer:
                sections.append({
                    "text": "\n".join(buffer),
                    "metadata": {
                        "source": filename,
                        "file_type": "DOCX",
                        "section": current_section,
                        "page": None
                    }
                })
        except Exception as e:
            print(f"[Error reading DOCX {filename}]: {e}")
        return sections

    @staticmethod
    def _load_text(path: Path, filename: str, ext: str) -> List[Dict[str, Any]]:
        sections = []
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            file_type = "Markdown" if ext == ".md" else "Text"
            
            # Split by headings if Markdown or structured text
            heading_pattern = r'(?m)^(?:#+\s*|Section\s+\d+:?\s*|\d+\.\s+)(.+)$'
            splits = re.split(heading_pattern, content)

            if len(splits) > 1:
                # First chunk before any heading
                if splits[0].strip():
                    sections.append({
                        "text": splits[0].strip(),
                        "metadata": {
                            "source": filename,
                            "file_type": file_type,
                            "section": "Overview",
                            "page": None
                        }
                    })

                for i in range(1, len(splits), 2):
                    sec_title = splits[i].strip()
                    sec_text = splits[i+1].strip() if i+1 < len(splits) else ""
                    if sec_text:
                        sections.append({
                            "text": f"{sec_title}\n{sec_text}",
                            "metadata": {
                                "source": filename,
                                "file_type": file_type,
                                "section": sec_title,
                                "page": None
                            }
                        })
            else:
                sections.append({
                    "text": content.strip(),
                    "metadata": {
                        "source": filename,
                        "file_type": file_type,
                        "section": "General",
                        "page": None
                    }
                })
        except Exception as e:
            print(f"[Error reading Text {filename}]: {e}")
        return sections
