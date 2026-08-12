import urllib.parse

def build_image_urls(data: dict, size: tuple = (1280, 720)) -> list:
    urls = []
    for i, x in enumerate(data.get("ideas", [])[:3]):
        prompt = (
            f"professional YouTube thumbnail, photorealistic DSLR photo, real human, "
            f"{x.get('visual_description', '')}, "
            f"{x.get('emotion', '')} facial expression, cinematic dramatic lighting, "
            f"natural skin texture, sharp focus, high detail, 4k photography, "
            f"no text, no words, no letters, no cartoon, no anime, no illustration, "
            f"no 3d render, no painting, no watermark"
        )[:700]
        enc = urllib.parse.quote(prompt)
        urls.append(
            f"https://image.pollinations.ai/prompt/{enc}"
            f"?width={size[0]}&height={size[1]}&seed={i + 1}&nologo=true&model=flux&enhance=true"
        )
    return urls