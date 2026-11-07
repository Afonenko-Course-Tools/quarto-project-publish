// @ts-check
(function(){
const base=__SITE_BASE__;
if(base){
 const course=new URL(base.courseUrl); course.pathname=course.pathname.replace(/\/$/,'')+'/';
 const root=new URL(base.rootHref,document.baseURI);
 for(const link of document.querySelectorAll('#quarto-header a[href],#quarto-sidebar a[href],.quarto-navbar a[href],.quarto-sidebar a[href]')){
  if (!(link instanceof HTMLAnchorElement)) continue;
  const url=new URL(link.href,document.baseURI);
  if(url.origin===course.origin&&url.pathname.startsWith(course.pathname)){
   let path=url.pathname.slice(course.pathname.length); if(!path||path.endsWith('/')) path+='index.html';
   link.href=new URL(path+url.search+url.hash,root).href;
  }
 }
}
const targets=__SITE_TARGETS__.map(path=>new URL(path,document.baseURI));
for(const link of document.querySelectorAll('a[href]')){
 if (!(link instanceof HTMLAnchorElement)) continue;
 const url=new URL(link.href,document.baseURI);
 if(targets.some(target=>target.origin===url.origin&&(
  target.pathname===url.pathname || target.pathname.endsWith('/index.html')&&target.pathname.slice(0,-'index.html'.length)===url.pathname
 ))){
  link.target='_blank'; link.rel=[...new Set([...link.rel.split(/\s+/).filter(Boolean),'noopener','noreferrer'])].join(' ');
 }
}
})();
