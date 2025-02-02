
const iframe1 = document.getElementById('iframe1');
const showHideButton = document.getElementById('show-hide')

showHideButton.addEventListener("click" ,function () {

    if (iframe1.style.display === 'block') {
        iframe1.style.display = 'none';

    } else{
        iframe1.style.display = 'block';
    }
})


const iframe2 = document.getElementById('iframe2');
const showHideButton2 = document.getElementById('show-hide2')


showHideButton2.addEventListener("click" ,function () {

    if (iframe2.style.display === 'block') {
        iframe2.style.display = 'none';

    } else{
        iframe2.style.display = 'block';
    }
})


textDescription = "This project is a form validation you can find the code "

const textDescription1 = document.getElementById('text-description');
const textDescription2 = document.getElementById('text-description2');

textDescription1.innerHTML = textDescription
textDescription2.innerHTML = textDescription


// function toggleIframe(iframeId) {
//     const iframe = document.getElementById(iframeId);
//     iframe.style.display = (iframe.style.display === 'block') ? 'none' : 'block';
// }

// document.getElementById('show-hide').addEventListener("click", () => toggleIframe('iframe1'));
// document.getElementById('show-hide2').addEventListener("click", () => toggleIframe('iframe2'));
