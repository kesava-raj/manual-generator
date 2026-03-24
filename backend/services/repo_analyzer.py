import os
import re
import json

class RepoAnalyzer:
    def __init__(self, root_path):
        self.root_path = root_path

    def get_tech_stack(self):
        """Analyze package.json and requirements.txt for tech stack"""
        stack = []
        
        # Check Node.js
        pkg_json = os.path.join(self.root_path, "package.json")
        if os.path.exists(pkg_json):
            try:
                with open(pkg_json, 'r') as f:
                    data = json.load(f)
                    deps = data.get("dependencies", {})
                    dev_deps = data.get("devDependencies", {})
                    for dep, ver in {**deps, **dev_deps}.items():
                        stack.append({"item": dep, "version": ver})
            except: pass

        # Check Python
        req_txt = os.path.join(self.root_path, "requirements.txt")
        if os.path.exists(req_txt):
            try:
                with open(req_txt, 'r') as f:
                    for line in f:
                        if "==" in line:
                            it, ver = line.strip().split("==")
                            stack.append({"item": it, "version": ver})
                        elif line.strip():
                            stack.append({"item": line.strip(), "version": "latest"})
            except: pass
            
        return stack

    def get_repo_layout(self, max_depth=3):
        """Generate an ASCII tree of the repository"""
        tree = []
        def _build_tree(path, prefix=""):
            if prefix.count("│   ") >= max_depth:
                return
            
            try:
                entries = sorted(os.listdir(path))
                # Filter out hidden or ignored
                entries = [e for e in entries if not e.startswith('.') and e != "node_modules" and e != "venv"]
                
                for i, entry in enumerate(entries):
                    connector = "└── " if i == len(entries) - 1 else "├── "
                    tree.append(f"{prefix}{connector}{entry}")
                    
                    full_path = os.path.join(path, entry)
                    if os.path.isdir(full_path):
                        _build_tree(full_path, prefix + ("    " if i == len(entries) - 1 else "│   "))
            except: pass

        tree.append(os.path.basename(self.root_path) or "root")
        _build_tree(self.root_path)
        return "\n".join(tree)

    def get_api_reference(self):
        """Heuristic to find FastAPI/Flask routes"""
        routes = []
        # Look for .py files
        for root, _, files in os.walk(self.root_path):
            if "venv" in root or ".git" in root: continue
            for file in files:
                if file.endswith(".py"):
                    try:
                        with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                            content = f.read()
                            # Match @router.get("/path") or @app.post("/path")
                            matches = re.finditer(r'@(?:router|app)\.(get|post|put|delete|patch)\("([^"]+)"', content)
                            for m in matches:
                                routes.append({
                                    "method": m.group(1).upper(),
                                    "path": m.group(2),
                                    "file": file
                                })
                    except: pass
        return routes

    def get_db_models(self):
        """Heuristic to find SQLAlchemy models"""
        models = []
        for root, _, files in os.walk(self.root_path):
            if "venv" in root or ".git" in root: continue
            for file in files:
                if file.endswith(".py"):
                    try:
                        with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                            content = f.read()
                            # Match class ModelName(Base):
                            class_matches = re.finditer(r'class\s+(\w+)\s*\((?:Base|SQLModel)\):', content)
                            for cm in class_matches:
                                model_name = cm.group(1)
                                fields = []
                                # Find fields: name = Column(Type, ...)
                                field_matches = re.finditer(r'^\s+(\w+)\s*=\s*Column\(([^)]+)\)', content, re.MULTILINE)
                                for fm in field_matches:
                                    fields.append({
                                        "name": fm.group(1),
                                        "type": fm.group(2).split(',')[0].strip()
                                    })
                                if fields:
                                    models.append({"name": model_name, "fields": fields})
                    except: pass
        return models

    def analyze(self):
        return {
            "tech_stack": self.get_tech_stack(),
            "layout": self.get_repo_layout(),
            "api": self.get_api_reference(),
            "db": self.get_db_models()
        }
