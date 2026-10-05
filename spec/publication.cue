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
  portal?: string & =~"^[A-Za-z0-9][A-Za-z0-9_.-]*\\.qmd$"
  "output-dir"?: string & =~"^[A-Za-z_][A-Za-z0-9_-]*$"
  projects: {[#Namespace]: #Project} & struct.MinFields(1)
  integrations?: [...string & !=""]
  if portal != _|_ {
    home?: _|_
    "output-dir": string
  }
  if portal == _|_ {
    "output-dir"?: _|_
  }
  if home != _|_ {
    projects: (home)!: {format: "html", mount?: _|_}
  }
}
