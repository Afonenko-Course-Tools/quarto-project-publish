local M = {}
local function text(v) return v and pandoc.utils.stringify(v) or "" end
function M.link(namespace, id, style, label)
  assert(quarto.doc.is_format("html"), "QRC supports HTML and Revealjs publication")
  assert(namespace:match("^[%a][%w_-]*$"), "QRC invalid namespace: " .. namespace)
  assert(id ~= "" and not id:match("[%s:#]"), "QRC invalid target ID: " .. id)
  assert(style == "default" or style == "number" or style == "title" or style == "external",
    "QRC invalid style: " .. style)
  local attrs = { ["data-qrc-ref"] = namespace .. ":" .. id,
    ["data-qrc-style"] = style, ["data-qrc-custom"] = label ~= "" and "true" or "false" }
  return pandoc.Link({pandoc.Str(label ~= "" and label or namespace .. ":" .. id)},
    "#qrc-unresolved", "", pandoc.Attr("", {"qrc-link"}, attrs))
end
M.text = text
return M
