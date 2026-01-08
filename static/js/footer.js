// Get modal and elements
const modalpr = document.getElementById("privacyModal");
const btnpr = document.getElementById("privacyLink");
const spanpr = modalpr.querySelector(".close");

// Open modal
btnpr.onclick = function() {
    modalpr.style.display = "block";
}

// Close modal
spanpr.onclick = function() {
    modalpr.style.display = "none";
}



// Get modal and elements
const modaltou = document.getElementById("termofuseModal");
const btnprtou = document.getElementById("termofuseLink");
const spanprtou = modaltou.querySelector(".close");

// Open modal
btnprtou.onclick = function() {
    modaltou.style.display = "block";
}

// Close modal
spanprtou.onclick = function() {
    modaltou.style.display = "none";
}

// Close if clicking outside the modal content
window.onclick = function(event) {
    if (event.target == modaltou || event.target == modalpr) {
        modaltou.style.display = "none";
        modalpr.style.display = "none";
    }
}

