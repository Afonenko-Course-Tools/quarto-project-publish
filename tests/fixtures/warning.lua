---@param doc pandoc.Pandoc
---@return pandoc.Pandoc
local function warn_native(doc)
  pandoc.log.warn("NATIVE_WARNING_SENTINEL")
  return doc
end
Pandoc = warn_native
