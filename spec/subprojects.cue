package composition

// Авторский контракт корня; native конфигурацией проекта управляет Quarto.
#Composition: {
  subprojects: [string & !="", ...string & !=""]
  "course-site"?: _|_
  ...
  // Нормализованные повторы, границы путей и пересечения проверяются по файловой системе.
}
