import os
import re
import json
from urllib.parse import urlparse

REPO_DIR = "/home/abdellah/Documents/ebpf/frontend-dev-bookmarks-repo"
OUTPUT_PATH = "/home/abdellah/Documents/ebpf/frontend-dev-bookmarks-app/src/data/bookmarks.json"

category_metadata = {
    "animation": {
        "id": "animation",
        "name": "Animation & Motion",
        "icon": "Activity",
        "color": "#ec4899",
        "description": "Web animations, CSS transitions, keyframes, canvas, WebGL and motion engines."
    },
    "appearance": {
        "id": "appearance",
        "name": "Appearance & Styling",
        "icon": "Palette",
        "color": "#a855f7",
        "description": "CSS techniques, styling architectures, design tokens, typography, and visualizations."
    },
    "architecture": {
        "id": "architecture",
        "name": "Architecture & Patterns",
        "icon": "Cpu",
        "color": "#3b82f6",
        "description": "Design patterns, functional programming, state management, and enterprise frontend systems."
    },
    "compatibility": {
        "id": "compatibility",
        "name": "Compatibility & Standards",
        "icon": "Globe",
        "color": "#06b6d4",
        "description": "Cross-browser testing, accessibility (a11y), mobile web, email rendering, and print CSS."
    },
    "ecosystem": {
        "id": "ecosystem",
        "name": "Ecosystem & Community",
        "icon": "Users",
        "color": "#10b981",
        "description": "Frontend communities, newsletters, tech leaders, podcasts, organizations, and open source."
    },
    "languages-protocols-browser-apis": {
        "id": "languages-protocols-browser-apis",
        "name": "Languages, Protocols & APIs",
        "icon": "Code2",
        "color": "#f59e0b",
        "description": "JavaScript, ECMAScript specs, CSS3, HTML5, HTTP/2, WebAssembly, DOM, and Web APIs."
    },
    "user-interface-components": {
        "id": "user-interface-components",
        "name": "UI Components & Controls",
        "icon": "Layout",
        "color": "#8b5cf6",
        "description": "Reusable UI controls, forms, buttons, image sliders, rich text editors, grids, and video players."
    },
    "workflow": {
        "id": "workflow",
        "name": "Workflow & Tooling",
        "icon": "Wrench",
        "color": "#ef4444",
        "description": "Build tools, bundlers, linters, code editors, automated testing, package managers, and dev setups."
    }
}

def clean_markdown_text(text):
    if not text:
        return ""
    # Strip inline markdown links like [Title](url) -> Title
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Strip bold / italics
    text = re.sub(r'[*_]{1,3}([^*_]+)[*_]{1,3}', r'\1', text)
    # Strip inline code backticks
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # Strip extra leading colons or hyphens
    text = re.sub(r'^[:\s\-]+', '', text)
    return text.strip()

def get_domain_from_url(url):
    if not url:
        return ""
    try:
        parsed = urlparse(url)
        netloc = parsed.netloc.lower()
        if netloc.startswith('www.'):
            netloc = netloc[4:]
        return netloc
    except Exception:
        return ""

def parse_markdown_file(file_path, category_id, subcategory_id):
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    lines = content.split('\n')
    file_title = ""
    file_description = ""
    bookmarks = []
    
    # Extract Title & Intro
    for line in lines:
        if line.startswith('# '):
            file_title = line.replace('# ', '').strip()
            break
            
    if not file_title:
        file_title = subcategory_id.replace('-', ' ').title()

    item_index = 0
    for line in lines:
        stripped = line.strip()
        if not (stripped.startswith('+ ') or stripped.startswith('* ') or stripped.startswith('- ')):
            continue
            
        # Match bold title + url or markdown link
        # 1: **[Name](url)**: Description
        # 2: **Name**: Description with [link](url)
        # 3: [Name](url): Description
        
        name = ""
        url = ""
        desc = ""

        m1 = re.search(r'\*\*(?:\[([^\]]+)\]\(([^)]+)\)|([^:]+))\*\*\s*:?\s*(.*)', stripped)
        if m1:
            name = m1.group(1) or m1.group(3) or ""
            url = m1.group(2) or ""
            desc = m1.group(4) or ""
        else:
            m2 = re.search(r'\[([^\]]+)\]\(([^)]+)\)\s*:?\s*(.*)', stripped)
            if m2:
                name = m2.group(1) or ""
                url = m2.group(2) or ""
                desc = m2.group(3) or ""
            else:
                continue

        if not url:
            # Check if url is embedded inside desc
            m_desc_link = re.search(r'\[([^\]]+)\]\(([^)]+)\)', desc)
            if m_desc_link:
                url = m_desc_link.group(2)
                if not name:
                    name = m_desc_link.group(1)

        name = clean_markdown_text(name)
        desc = clean_markdown_text(desc)

        if not name or not url:
            continue

        # Skip anchor links or relative markdown files without absolute urls
        if url.startswith('#') or url.endswith('.md'):
            if 'http' not in url:
                continue

        domain = get_domain_from_url(url)
        
        # Determine resource type
        resource_type = "article"
        if "github.com" in domain or "gitlab.com" in domain:
            resource_type = "repository"
        elif "youtube.com" in domain or "vimeo.com" in domain or "youtu.be" in domain or "twitch.tv" in domain:
            resource_type = "video"
        elif "twitter.com" in domain or "x.com" in domain or "reddit.com" in domain:
            resource_type = "social"
        elif "podcast" in subcategory_id or "spotify.com" in domain or "apple.com" in domain:
            resource_type = "podcast"
        elif "w3.org" in domain or "tc39.es" in domain or "developer.mozilla.org" in domain:
            resource_type = "spec"
        elif "npm" in name.lower() or "cli" in name.lower() or "tool" in subcategory_id:
            resource_type = "tool"

        tags = [category_id, subcategory_id, resource_type]
        if domain:
            tags.append(domain.split('.')[0])

        item_index += 1
        bookmarks.append({
            "id": f"{subcategory_id}-{item_index}",
            "title": name,
            "url": url,
            "description": desc,
            "category": category_id,
            "category_name": category_metadata.get(category_id, {}).get("name", category_id),
            "subcategory": subcategory_id,
            "subcategory_name": file_title,
            "domain": domain,
            "type": resource_type,
            "tags": list(set(tags))
        })

    return file_title, bookmarks

def main():
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    all_bookmarks = []
    category_data = {}

    cat_dirs = [d for d in os.listdir(REPO_DIR) if os.path.isdir(os.path.join(REPO_DIR, d)) and not d.startswith('.')]

    for cat_id in cat_dirs:
        if cat_id not in category_metadata:
            continue

        cat_path = os.path.join(REPO_DIR, cat_id)
        meta = category_metadata[cat_id]
        
        cat_obj = {
            "id": cat_id,
            "name": meta["name"],
            "icon": meta["icon"],
            "color": meta["color"],
            "description": meta["description"],
            "subcategories": [],
            "total_bookmarks": 0
        }

        for fname in sorted(os.listdir(cat_path)):
            if fname.endswith('.md'):
                subcat_id = fname[:-3]
                file_path = os.path.join(cat_path, fname)
                subcat_title, bmarks = parse_markdown_file(file_path, cat_id, subcat_id)
                
                if bmarks:
                    cat_obj["subcategories"].append({
                        "id": subcat_id,
                        "name": subcat_title,
                        "count": len(bmarks)
                    })
                    cat_obj["total_bookmarks"] += len(bmarks)
                    all_bookmarks.extend(bmarks)

        category_data[cat_id] = cat_obj

    print(f"Total bookmarks parsed: {len(all_bookmarks)}")
    print(f"Categories parsed: {len(category_data)}")

    output_dataset = {
        "categories": category_data,
        "bookmarks": all_bookmarks,
        "meta": {
            "total": len(all_bookmarks),
            "source": "https://github.com/dypsilon/frontend-dev-bookmarks",
            "license": "CC BY 4.0"
        }
    }

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output_dataset, f, indent=2)

    print(f"Dataset successfully saved to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
