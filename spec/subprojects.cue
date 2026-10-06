package composition

// Root authoring contract; native project configuration remains Quarto's.
#Composition: {
  subprojects: [string & !="", ...string & !=""]
  "course-site"?: _|_
  ...
  // Normalized duplicates, path containment and overlaps are filesystem checks.
}
