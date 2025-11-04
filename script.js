// Manejo dinámico de iframes y botones
// Replace title click with button-based toggling

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.toggle-preview');
  if (!btn) return;
  // find the iframe in the same project-item
  const item = btn.closest('.project-item');
  if (!item) return;
  const iframe = item.querySelector('iframe.iframe');
  if (!iframe) return;
  const isVisible = iframe.style.display === 'block';
  iframe.style.display = isVisible ? 'none' : 'block';
  const label = btn.querySelector('[data-i18n="programming.preview"]');
  if (label) label.textContent = isVisible ? (window.t ? window.t('programming.preview','Show demo') : 'Show demo') : (window.t ? window.t('programming.hide','Hide demo') : 'Hide demo');
});

// Texto de descripción para los proyectos
const textDescription = "This project is a form validation you can find the code";
document.querySelectorAll(".description-project").forEach(description => {
    description.innerHTML = textDescription;
});

const menu = document.querySelector('#menu-icon');
const navlist = document.querySelector('.navlist');

if (menu && navlist) {
    const closeMenu = () => {
        menu.classList.remove('bx-x');
        navlist.classList.remove('open');
        menu.setAttribute('aria-expanded', 'false');
    };

    menu.onclick = () => {
        console.log("estoy click")
        const isOpen = navlist.classList.toggle('open');
        menu.classList.toggle('bx-x', isOpen);
        menu.setAttribute('aria-expanded', String(isOpen));
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });
}

// Programming page: search filter
(function(){
  const input = document.getElementById('programming-search');
  if (!input) return;
  const items = Array.from(document.querySelectorAll('.programming-list .project-item'));
  function normalize(s){ return (s||'').toString().toLowerCase(); }
  function hay(item){
    const title = item.querySelector('h2')?.textContent || '';
    const desc = item.querySelector('.description-project')?.textContent || '';
    return `${title} ${desc}`.toLowerCase();
  }
  input.addEventListener('input', (e)=>{
    const q = normalize(e.target.value);
    items.forEach(it => { it.style.display = hay(it).includes(q) ? '' : 'none'; });
  });
})();


const sr = ScrollReveal({
    distance: '60px',
    duration: 800,
    delay: 200,
    reset: false
})

sr.reveal('.hero-text',{delay:200, origin: 'top'})
sr.reveal('.hero-image',{delay:300, origin: 'right'})
sr.reveal('.icons',{delay:500, origin: 'left'})
sr.reveal('.scroll-down',{delay:800, origin: 'top'})

// const iframe1 = document.getElementById('iframe1');
// const showHideButton = document.getElementById('show-hide')

// showHideButton.addEventListener("click" ,function () {

//     iframe3.style.display = (iframe3.style.display === 'block') ? 'none' : 'block';

// })


// const iframe2 = document.getElementById('iframe2');
// const showHideButton2 = document.getElementById('show-hide2')


// showHideButton2.addEventListener("click" ,function () {

//     iframe2.style.display = (iframe2.style.display === 'block') ? 'none' : 'block';

// })



// const iframe3 = document.getElementById('iframe3');
// const showHideButton3 = document.getElementById('show-hide3')


// showHideButton3.addEventListener("click" ,function () {

//     iframe3.style.display = (iframe3.style.display === 'block') ? 'none' : 'block';
    
// })


// textDescription = "This project is a form validation you can find the code "

// const textDescription1 = document.getElementById('text-description');
// const textDescription2 = document.getElementById('text-description2');
// const textDescription3 = document.getElementById('text-description3');

// textDescription1.innerHTML = textDescription
// textDescription2.innerHTML = textDescription
// textDescription3.innerHTML = textDescription


// // function toggleIframe(iframeId) {
// //     const iframe = document.getElementById(iframeId);
// //     iframe.style.display = (iframe.style.display === 'block') ? 'none' : 'block';
// // }

// // document.getElementById('show-hide').addEventListener("click", () => toggleIframe('iframe1'));
// // document.getElementById('show-hide2').addEventListener("click", () => toggleIframe('iframe2'));
