"""Validate shared instruction entry points and local document references; stdlib only."""
from pathlib import Path
import argparse
import re
import sys


def validate(root):
    managed = ['AGENTS.md', 'agent.md', 'CLAUDE.md', 'GEMINI.md',
               '.github/copilot-instructions.md', 'PROJECT.md', 'TASKS.md',
               'DECISIONS.md', 'docs/AGENT-WORKFLOW.md']
    errors = []
    graph = {}
    for name in managed:
        path = root / name
        if not path.is_file():
            errors.append(f'Missing {name}')
            continue
        text = path.read_text(encoding='utf-8')
        if not text.strip():
            errors.append(f'Empty {name}')
        if text.count('```') % 2:
            errors.append(f'Unclosed code fence: {name}')
        # Only standalone imports are used by these thin adapters.
        imports = re.findall(r'^@([^\s]+)\s*$', text, re.M)
        graph[name] = []
        for target in imports:
            resolved = (path.parent / target).resolve()
            if not resolved.is_relative_to(root):
                errors.append(f'Import leaves repository: {name}: {target}')
            elif not resolved.is_file():
                errors.append(f'Missing import: {name}: {target}')
            else:
                graph[name].append(str(resolved.relative_to(root)))
        for target in re.findall(r'\]\(([^)]+)\)', text):
            target = target.split('#', 1)[0]
            if not target or re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', target):
                continue
            if not (path.parent / target).exists():
                errors.append(f'Missing local link: {name}: {target}')
    for name in ['CLAUDE.md', 'GEMINI.md']:
        if 'AGENTS.md' not in graph.get(name, []):
            errors.append(f'{name} must import root AGENTS.md')
    for name in ['agent.md', '.github/copilot-instructions.md']:
        if (root / name).is_file() and 'AGENTS.md' not in (root / name).read_text():
            errors.append(f'{name} must point to AGENTS.md')
    if (root / 'AGENTS.md').is_file():
        text = (root / 'AGENTS.md').read_text()
        for target in ['PROJECT.md', 'TASKS.md', 'DECISIONS.md', 'docs/AGENT-WORKFLOW.md']:
            if target not in text:
                errors.append(f'AGENTS.md must direct readers to {target}')
        if re.search(r'\]\(agent\.md\)', text):
            errors.append('AGENTS.md must not delegate back to the agent.md redirect')
    def visit(name, stack):
        if name in stack:
            errors.append('Circular import: ' + ' -> '.join(stack + [name]))
            return
        for target in graph.get(name, []):
            visit(target, stack + [name])
    for name in graph:
        visit(name, [])
    return errors


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    root = parser.parse_args().root.resolve()
    errors = validate(root)
    for error in errors:
        print(error, file=sys.stderr)
    if errors:
        sys.exit(1)
    print('Shared agent documentation: entry points, imports, links and authority passed.')
