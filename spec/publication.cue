package publication

import "struct"

// Формат по умолчанию одинаков для всех подпроектов: обычный HTML.
#Namespace: string & =~"^[A-Za-z][A-Za-z0-9_-]*$"
#Project: {
  path: string & !=""
  format: *"html" | "revealjs" | "pdf"
  mount?: #Namespace
}
#Publication: {
  home?: #Namespace
  projects: {[#Namespace]: #Project} & struct.MinFields(1)
  integrations?: [...string & !=""]
  if home != _|_ {
    projects: (home)!: {format: "html", mount?: _|_}
  }
}
