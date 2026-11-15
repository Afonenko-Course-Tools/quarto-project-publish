std = "lua54"
jobs = 1
codes = true
max_line_length = false
read_globals = { "pandoc", "quarto" }
files["tests/fixtures/*.lua"] = { globals = { "Pandoc" } }
files["typecheck/native.d.lua"] = { globals = { "pandoc" } }
