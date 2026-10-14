/* Нейтральный native fixture: композиция, standalone, профили и индексные входы. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
const playwright = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '', 'playwright'));
const repo = path.resolve(__dirname,'..');
const navigation = path.resolve(process.env.COURSE_CORE_PROVIDER || path.join(repo,'../quarto-course'));
const root = fs.mkdtempSync(path.join(os.tmpdir(),'site-navigation-'));
const write = (file,text) => {fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true}); fs.writeFileSync(path.join(root,file),text);};
const run = (args,cwd=root) => execFileSync(process.env.QUARTO || 'quarto',args,{cwd,stdio:'pipe'});
const child = 'units/slides';
write('_quarto.yml', `project:
  type: website
  output-dir: _site
  render: [index.qmd, route.qmd]
  resources: ['!units/**', '!theory/**', '!_extensions/**', '!_generated/**']
  pre-render: _extensions/course-site/entrypoints/pre.ts
  post-render: _extensions/course-site/entrypoints/post.ts
subprojects: [units/slides, theory, deck]
format: html
lang: ru
website:
  site-url: https://neutral.example/course/
  repo-url: https://github.com/neutral/learning
  repo-branch: 0123456789abcdef
  repo-actions: [source, issue]
`);
write('index.qmd', '# Содержание\n\n[Доклад](units/slides/chapters/special.html#first)\n\n[Теория](theory/index.html)\n\n[Страница](route.qmd)\n');
write('route.qmd', '# Обычная страница\n\n[Доклад](units/slides/chapters/special.html)\n\n::: {.reveal}\nОбычный HTML-блок.\n:::\n');
write(`${child}/_quarto.yml`, `project:
  type: website
  output-dir: _output
  render: [index.qmd, chapters/talk.qmd]
  post-render: ../../_extensions/course-site/entrypoints/collect.ts
format:
  revealjs:
    revealjs-plugins: [course-navigation]
filters: [course-navigation]
lang: ru
repo-url: &repo_url https://github.com/neutral/learning
repo-branch: &repo_revision 0123456789abcdef
repo-subdir: &repo_subdir units/slides
repo-actions: &repo_actions [source, issue]
website:
  repo-url: *repo_url
  repo-branch: *repo_revision
  repo-subdir: *repo_subdir
  repo-actions: *repo_actions
course-navigation:
  course-url: https://neutral.example/course/
  links:
    - {text: Курс, href: /index.html, scope: course}
    - {text: Все материалы, href: /index.html, scope: project}
    - {text: Теория, href: /theory/index.html, scope: course}
`);
write(`${child}/index.qmd`, '---\nformat: html\n---\n\n# Материалы\n\n[Доклад](chapters/special.html#first)\n\n[Обычная ссылка](https://example.org/)\n');
write(`${child}/chapters/talk.qmd`, '---\ntitle: Доклад\noutput-file: special.html\n---\n\n## Первый {#first}\n\nСодержание.\n\n## Второй\n\nВывод.\n');
write('theory/_quarto.yml', 'project:\n  type: book\n  output-dir: _output\n  post-render: ../_extensions/course-site/entrypoints/collect.ts\nformat: html\nlang: ru\nbook:\n  title: Теория\n  chapters: [index.qmd]\n  navbar:\n    left:\n      - {text: Курс, href: https://neutral.example/course/index.html}\n      - {text: Теория, href: https://neutral.example/course/theory/index.html}\n  repo-url: https://github.com/neutral/learning\n  repo-branch: 0123456789abcdef\n  repo-subdir: theory\n  repo-actions: [source, issue]\n');
write('deck/_quarto.yml', 'project:\n  type: default\n  output-dir: _output\n  render: [index.qmd]\n  post-render: ../_extensions/course-site/entrypoints/collect.ts\nformat: revealjs\nlang: ru\n');
write('deck/index.qmd','## Первый\n\n[Продолжение](#second)\n\n## Второй {#second}\n\nВывод.\n');
write('theory/index.qmd','# Теория\n\n[Связь в тексте](https://neutral.example/course/units/slides/chapters/special.html)\n');
for (const [directory,base] of [['','_site'],[child,'_output'],['theory','_output'],['deck','_output']]) {
  for (const profile of ['student','full']) write(`${directory ? directory+'/' : ''}_quarto-${profile}.yml`, `project:\n  output-dir: ${base}-${profile}\n`);
}
const server = http.createServer((req,res) => {
  let file = path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1)));
  if (!file.startsWith(root+path.sep)) {res.writeHead(403).end(); return;}
  if(fs.existsSync(file) && fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
  fs.readFile(file,(error,data)=>{if(error) res.writeHead(404).end(); else {res.setHeader('Content-Type',path.extname(file)==='.html'?'text/html; charset=utf-8':path.extname(file)==='.js'?'text/javascript':path.extname(file)==='.css'?'text/css':'application/octet-stream');res.end(data);}});
});
(async()=>{
  let browser;
  try {
    run(['add',repo,'--no-prompt']);
    fs.cpSync(path.join(navigation,'_extensions/course-navigation'),path.join(root,child,'_extensions/course-navigation'),{recursive:true});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${server.address().port}`;
    browser=await playwright.chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
    const page=await browser.newPage();
    for (const profile of ['student','full']) {
      run(['render','--profile',profile,'--fail-if-warnings']);
      const base=`${origin}/_site-${profile}`;
      await page.goto(`${base}/index.html`);
      assert.equal(await page.getByRole('link',{name:'Доклад',exact:true}).getAttribute('target'),'_blank','Общий индекс открывает реальную Reveal-презентацию в новой вкладке');
      assert.equal(await page.getByRole('link',{name:'Теория',exact:true}).last().getAttribute('target'),null);
      assert.equal(await page.getByRole('link',{name:'Страница',exact:true}).getAttribute('target'),null,'HTML-класс reveal не превращает обычную страницу в презентацию');
      const popup=page.waitForEvent('popup'); await page.getByRole('link',{name:'Доклад',exact:true}).click();
      const deck=await popup; await deck.waitForSelector('.course-nav-counter');
      await deck.locator('.course-nav-controls [data-action=next]').click();
      assert.equal(page.url(),`${base}/index.html`);
      const links=deck.locator('.course-nav-sidebar .course-nav-permanent a');
      assert.deepEqual(await links.evaluateAll(list=>list.map(a=>a.href)),[
        `${base}/index.html`,`${base}/${child}/index.html`,`${base}/theory/index.html`,
        'https://github.com/neutral/learning/blob/0123456789abcdef/units/slides/chapters/talk.qmd',
        'https://github.com/neutral/learning/issues/new',
      ]);
      await deck.getByRole('link',{name:'Все материалы',exact:true}).first().click(); await deck.waitForURL(`${base}/${child}/index.html`);
      assert.equal(await deck.getByRole('link',{name:'Доклад',exact:true}).getAttribute('target'),'_blank'); await deck.close();
      await page.goto(`${base}/deck/index.html`);
      assert.equal(await page.getByRole('link',{name:'Продолжение',exact:true}).getAttribute('target'),null,'Reveal index.html сохраняет переходы внутри презентации');
      await page.goto(`${base}/route.html`);
      assert.equal(await page.getByRole('link',{name:'Доклад',exact:true}).getAttribute('target'),null,'Обычная страница сохраняет поведение ссылки');
      await page.goto(`${base}/${child}/chapters/special.html`); await page.waitForSelector('.course-nav-counter');
      assert.equal(await page.evaluate(()=>window.opener),null);
      await page.getByRole('link',{name:'Курс',exact:true}).first().click(); await page.waitForURL(`${base}/index.html`);
      await page.goto(`${base}/theory/index.html`);
      assert.equal(await page.locator('.navbar-nav a').filter({hasText:'Курс'}).first().evaluate(a=>a.href), `${base}/`, 'Native navbar получает адрес композиции');
      assert.equal(await page.locator('.navbar-nav a').filter({hasText:'Теория'}).first().evaluate(a=>a.href), `${base}/theory/`);
      assert.equal(await page.getByRole('link',{name:'Связь в тексте',exact:true}).getAttribute('href'),'https://neutral.example/course/units/slides/chapters/special.html','Авторская ссылка в тексте не получает overlay');
      await page.locator('.navbar-nav a').filter({hasText:'Курс'}).first().click(); await page.waitForURL(`${base}/`);
      await page.goto(`${base}/theory/index.html`);
      assert.equal(await page.locator('.toc-actions a').filter({hasText:'Показать код'}).first().getAttribute('href'),'https://github.com/neutral/learning/blob/0123456789abcdef/theory/index.qmd');
      assert.equal(await page.locator('.toc-actions a').filter({hasText:'Сообщить о проблеме'}).first().getAttribute('href'),'https://github.com/neutral/learning/issues/new');
      run(['render','--profile',profile,'--fail-if-warnings'],path.join(root,child));
      const standalone=`${origin}/${child}/_output-${profile}`;
      await page.goto(`${standalone}/index.html`);
      assert.equal(await page.getByRole('link',{name:'Доклад',exact:true}).getAttribute('target'),'_blank');
      assert.equal(await page.getByRole('link',{name:'Обычная ссылка',exact:true}).getAttribute('target'),null);
      await page.goto(`${standalone}/chapters/special.html`); await page.waitForSelector('.course-nav-counter');
      assert.equal(await page.getByRole('link',{name:'Курс',exact:true}).first().getAttribute('href'),'https://neutral.example/course/index.html');
      assert.equal(await page.getByRole('link',{name:'Все материалы',exact:true}).first().getAttribute('href'),'../index.html');
      run(['render','--profile',profile,'--fail-if-warnings'],path.join(root,'theory'));
      await page.goto(`${origin}/theory/_output-${profile}/index.html`);
      assert.equal(await page.locator('.navbar-nav a').filter({hasText:'Курс'}).first().getAttribute('href'),'https://neutral.example/course/','Standalone native navbar сохраняет публичный адрес');
      assert.equal(await page.locator('.navbar-nav a').filter({hasText:'Теория'}).first().getAttribute('href'),'https://neutral.example/course/theory/');
    }
    console.log('PASS нейтральная композиция и standalone, student/full, nested mount/output-file, входы с индексов, прямые выходы без opener, native book source/issue');
  } finally {
    if(browser) await browser.close();
    if(server.listening) await new Promise(resolve=>server.close(resolve));
    if(process.env.SITE_NAVIGATION_KEEP) console.log(root); else fs.rmSync(root,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
