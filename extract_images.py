import fitz  # PyMuPDF
import os

pdf_path = "/Users/eugeniucazmal/Downloads/dev_office/smart invoice/Ducati v4s - Invoice_0023811.PDF"
output_dir = "/Users/eugeniucazmal/Downloads/dev_office/smart invoice/invoice_images"

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

doc = fitz.open(pdf_path)

for page_index in range(len(doc)):
    page = doc[page_index]
    image_list = page.get_images(full=True)
    
    if image_list:
        print(f"[+] Found a total of {len(image_list)} images in page {page_index}")
    else:
        print("[!] No images found on page", page_index)
        
    for image_index, img in enumerate(page.get_images(full=True)):
        xref = img[0]
        base_image = doc.extract_image(xref)
        image_bytes = base_image["image"]
        image_ext = base_image["ext"]
        image_name = f"image_{page_index}_{image_index}.{image_ext}"
        
        with open(os.path.join(output_dir, image_name), "wb") as f:
            f.write(image_bytes)
            print(f"[+] Image saved as {image_name}")

doc.close()
