---@param doc pandoc.Pandoc
---@return pandoc.Pandoc
function Pandoc(doc)
  pandoc.log.warn('NATIVE_WARNING_SENTINEL')
  return doc
end
