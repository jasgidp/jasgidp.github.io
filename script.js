// Manejo dinámico de iframes y botones
document.querySelectorAll(".show-hide").forEach(button => {
    button.addEventListener("click", function () {
        let nextElement = this.nextElementSibling; // Iniciar desde el siguiente elemento

        while (nextElement) {
            if (nextElement.tagName === "IFRAME") {
                // Alternar la visibilidad del iframe encontrado
                nextElement.style.display = (nextElement.style.display === "block") ? "none" : "block";
                break; // Salir del bucle después de encontrar el iframe
            }
            nextElement = nextElement.nextElementSibling; // Continuar buscando
        }
    });
});

// Texto de descripción para los proyectos
const textDescription = "This project is a form validation you can find the code";
document.querySelectorAll(".description-project").forEach(description => {
    description.innerHTML = textDescription;
});

const menu = document.querySelector('#menu-icon');
const navlist = document.querySelector('.navlist');

menu.onclick = () => {
    console.log("estoy click")
    menu.classList.toggle('bx-x');
    navlist.classList.toggle('open');
}


const sr = ScrollReveal({
    distance: '60px',
    duration: 2500,
    delay: 400,
    reset: true
})

sr.reveal('.hero-text',{delay:200, origin: 'top'})
sr.reveal('.hero-img',{delay:300, origin: 'right'})
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
