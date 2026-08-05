import os
import re
import json

REPO_DIR = "/home/abdellah/Documents/ebpf/frontend-dev-bookmarks-repo"

categories = [
    "animation",
    "appearance",
    "architecture",
    "compatibility",
    "ecosystem",
    "languages-protocols-browser-apis",
    "user-interface-components",
    "workflow"
]

category_names = {
    "animation": "Animation & Motion",
    "appearance": "Appearance & Styling",
    "architecture": "Architecture & Patterns",
    "compatibility": "Compatibility & Web Standards",
    "ecosystem": "Ecosystem & Community",
    "languages-protocols-browser-apis": "Languages, Protocols & APIs",
    "user-interface-components": "UI Components & Controls",
    "workflow": "Workflow & Tooling"
}

def parse_markdown_file(file_path, category_id, subcategory_id):
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    lines = content.split('\n')
    title = ""
    sub_title = ""
    bookmarks = []
    
    # Try to extract title from H1
    for line in lines:
        if line.startswith('# '):
            title = line.replace('# ', '').strip()
            break
            
    if not title:
        title = subcategory_id.replace('-', ' ').title()

    # Parse bullet items
    # Format: + **[Link Title](url)**: Description
    # or + **Title**: Description
    # or nested + **[Sublink](url)**
    
    current_parents = []
    
    for line in lines:
        stripped = line.strip()
        if not stripped.startswith('+ ') and not stripped.startswith('* ') and not stripped.startswith('- '):
            continue
            
        indent_level = len(line) - len(line.lstrip())
        
        # Match bold title + link or text
        # Patterns:
        # + **[Title](url)**: Description
        # + **Title**: Description
        # + [Title](url): Description
        
        link_match = re.search(r'\*\*(?:\[([^\]]+)\]\(([^)]+)\)|([^:]+))\*\*\s*:?\s*(.*)', stripped)
        if not link_match:
            # Fallback simple link match
            link_match2 = re.search(r'\[([^\]]+)\]\(([^)]+)\)\s*:?\s*(.*)', stripped)
            if link_match2:
                name = link_match2.group(1).strip()
                url = link_match2.group(2).strip()
                desc = link_match2.group(3).strip()
                bookmarks.append({
                    "name": name,
                    "url": url,
                    "description": desc,
                    "category": category_id,
                    "subcategory": subcategory_id,
                    "file_title": title,
                    "tags": [category_id, subcategory_id]
                })
            continue

        item_title = link_match.group(1) or link_match.group(3) or ""
        item_url = link_match.group(2) or ""
        item_desc = link_match.group(4) or ""

        # Clean title & desc
        item_title = item_title.strip()
        item_desc = item_desc.strip()

        # Extract nested url if present in item_desc
        if not item_url:
            desc_url_match = re.search(r'\[([^\]]+)\]\(([^)]+)\)', item_desc)
            if desc_url_match and not item_title:
                item_title = desc_url_match.group(1)
                item_url = desc_url_match.group(2)
            elif desc_url_match and item_title and not item_url:
                item_url = desc_url_match.group(2)

        if item_title:
            # Detect github repo, youtube video, article, tool, library tags
            tags = [category_id, subcategory_id]
            is_github = "github.com" in item_url
            is_youtube = "youtube.com" in item_url or "youtu.be" in item_url or "vimeo.com" in item_url
            is_medium = "medium.com" in item_url or "dev.to" in item_url
            
            if is_github:
                tags.append("GitHub")
            if is_youtube:
                tags.append("Video")
            if is_medium:
                tags.append("Article")

            bookmarks.append({
                "id": f"{subcategory_id}-{len(bookmarks)}",
                "name": item_title,
                "url": item_url,
                "description": item_desc,
                "category": category_id,
                "category_name": category_names.get(category_id, category_id),
                "subcategory": subcategory_id,
                "file_title": title,
                "tags": tags,
                "is_github": is_github,
                "is_video": is_youtube
            })

    return title, bookmarks

def main():
    all_bookmarks = []
    category_summary = {}

    for cat in categories:
        cat_dir = os.path.join(REPO_DIR, cat)
        if not os.path.isdir(cat_dir):
            continue
            
        category_summary[cat] = {
            "id": cat,
            "name": category_names.get(cat, cat.replace('-', ' ').title()),
            "subcategories": []
        }

        for fname in os.listdir(cat_dir):
            if fname.endswith('.md'):
                subcat_id = fname[:-3]
                file_path = os.path.join(cat_dir, fname)
                subcat_title, bmarks = parse_markdown_file(file_path, cat, subcat_id)
                
                category_summary[cat]["subcategories"].append({
                    "id": subcat_id,
                    "title": subcat_title,
                    "count": len(bmarks)
                })
                
                all_bookmarks.extend(bmarks)

    print(f"Total parsed bookmarks: {len(all_bookmarks)}")
    
    data = {
        "categories": category_summary,
        "total_count": len(all_bookmarks),
        "bookmarks": all_bookmarks
    }

    output_path = "/tmp/parsed_bookmarks.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

    print(f"Saved dataset to {output_path}")

if __name__ == "__main__":
    main()
