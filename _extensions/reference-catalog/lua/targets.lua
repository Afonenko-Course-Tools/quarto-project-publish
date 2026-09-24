-- This adapter consumes documented Pandoc/Quarto nodes, never a private index.
local M = {}
local types = {}
local ids = {}
local titles = {}
local function str(v) return v and pandoc.utils.stringify(v) or "" end
function M.init(meta)
  for name in ("fig tbl lst eq sec thm lem cor prp cnj def exm exr sol rem alg nte tip wrn imp cau"):gmatch("%S+") do
    types[name] = true
  end
  local crossref = meta.crossref
  if crossref and crossref.custom then
    for _, item in ipairs(crossref.custom) do types[str(item.key)] = true end
  end
end
function M.capture(el)
  local id = el.identifier or (el.attr and el.attr.identifier)
  if not id and el.div then id = el.div.identifier end
  if id and types[id:match("^([^-]+)%-")] then
    ids[id] = true
    if el.t == "Header" and id:match("^sec%-") and
      (el.classes:includes("unnumbered") or not PANDOC_WRITER_OPTIONS.number_sections) then
      titles[id] = el.content
    end
  end
end
function M.equations(block)
  -- Equation labels remain ordinary inline annotations at post-ast.
  -- Only inspect attributes immediately following display math, never code/text.
  local pending = false
  for _, el in ipairs(block.content) do
    if el.t == "Math" and el.mathtype == "DisplayMath" then pending = true
    elseif pending and (el.t == "Space" or el.t == "SoftBreak") then
    elseif pending and el.t == "Str" then
      local id = el.text:match("^{#(eq%-[^}%s]+)")
      if id then ids[id] = true end
      pending = false
    else pending = false end
  end
end
function M.sorted()
  local out = {}; for id in pairs(ids) do out[#out + 1] = id end
  table.sort(out); return out
end
function M.title(id) return titles[id] end
return M
