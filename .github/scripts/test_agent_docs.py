"""Regression tests for broken/missing/circular assistant instruction wiring."""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from check_agent_docs import validate


class AgentDocsTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        files = {
            'AGENTS.md': 'Read PROJECT.md TASKS.md DECISIONS.md docs/AGENT-WORKFLOW.md.',
            'agent.md': '[Shared](AGENTS.md)',
            'CLAUDE.md': '@AGENTS.md\n',
            'GEMINI.md': '@./AGENTS.md\n',
            '.github/copilot-instructions.md': 'Read AGENTS.md.',
            'PROJECT.md': '# Project', 'TASKS.md': '# Tasks', 'DECISIONS.md': '# Decisions',
            'docs/AGENT-WORKFLOW.md': '# Handover',
        }
        for name, text in files.items():
            path = self.root/name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)

    def test_valid_shared_entry_points(self):
        self.assertEqual(validate(self.root), [])

    def test_missing_import_and_link_are_reported(self):
        (self.root/'GEMINI.md').write_text('@missing.md\n[missing](missing.md)')
        errors = '\n'.join(validate(self.root))
        self.assertIn('Missing import', errors)
        self.assertIn('Missing local link', errors)

    def test_circular_import_is_rejected(self):
        (self.root/'CLAUDE.md').write_text('@AGENTS.md\n@GEMINI.md\n')
        (self.root/'GEMINI.md').write_text('@AGENTS.md\n@CLAUDE.md\n')
        self.assertTrue(any('Circular import' in e for e in validate(self.root)))

    def test_external_import_and_reverse_authority_are_rejected(self):
        (self.root/'GEMINI.md').write_text('@AGENTS.md\n@../private.md\n')
        with (self.root/'AGENTS.md').open('a') as f:
            f.write('\n[delegate](agent.md)')
        errors = '\n'.join(validate(self.root))
        self.assertIn('Import leaves repository', errors)
        self.assertIn('must not delegate back', errors)

    def test_missing_required_document_is_reported(self):
        (self.root/'TASKS.md').unlink()
        self.assertIn('Missing TASKS.md', validate(self.root))


if __name__ == '__main__':
    unittest.main()
