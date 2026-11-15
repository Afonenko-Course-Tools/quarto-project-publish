---@param doc pandoc.Pandoc
local function count_formats(doc)
  local target = assert(os.getenv("COURSE_FORMAT_COUNTS"))
  local file = assert(io.open(target, "a"))
  file:write(
    pandoc.utils.stringify(doc.meta.title) .. ":" .. quarto.format.format_identifier()["target-format"] .. "\n"
  )
  file:close()
end
Pandoc = count_formats
