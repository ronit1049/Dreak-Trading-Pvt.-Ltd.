import { BASE_URL } from "./config.js"

// Newsletter
function handleNewsletter(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.textContent = '✓ Subscribed!';
    btn.style.background = '#3aad6b';
    e.target.querySelector('input').value = '';
    setTimeout(() => { btn.textContent = 'Subscribe'; btn.style.background = ''; }, 3000);
}

// Scroll animations
const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });
function observeAll() {
    document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
}

// Nav scroll effect
window.addEventListener('scroll', () => {
    document.getElementById('navbar').style.boxShadow = window.scrollY > 50 ? '0 4px 20px rgba(0,0,0,.08)' : 'none';
});

// Init
// renderProducts('all');
observeAll();
// updateAllProductQty();

// Trigger initial animations
setTimeout(() => {
    document.querySelectorAll('.fade-up').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight) el.classList.add('visible');
    });
}, 100);

// Hide header when scrolling down, show when scrolling up
let lastScroll = 0;
const topWrapper = document.getElementById("topWrapper");

window.addEventListener("scroll", () => {

    const currentScroll = window.pageYOffset;

    if (currentScroll > lastScroll && currentScroll > 100) {
        // Scroll Down
        topWrapper.classList.add("hide");
    }
    else {
        // Scroll Up
        topWrapper.classList.remove("hide");
    }

    lastScroll = currentScroll;

});

// Scroll to top
const backToTop = document.getElementById("backToTop");

backToTop.addEventListener("click", function () {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});

// Show / Hide scroll buttons
const scrollUpBtn = document.getElementById("backToTop");
const scrollDownBtn = document.getElementById("scrollDown");

window.addEventListener("scroll", () => {

    const scrollTop = window.scrollY;
    const pageHeight = document.documentElement.scrollHeight;
    const windowHeight = window.innerHeight;

    // Show UP button when user scrolls down
    if (scrollTop > 200) {
        scrollUpBtn.classList.add("show");
    } else {
        scrollUpBtn.classList.remove("show");
    }

    // Hide DOWN button at bottom
    if (scrollTop + windowHeight >= pageHeight - 10) {
        scrollDownBtn.style.display = "none";
    } else {
        scrollDownBtn.style.display = "flex";
    }

});

// HERO SLIDER
let slides = document.querySelectorAll(".slide");
let currentSlide = 0;

function showSlide(index) {
    slides.forEach(s => s.classList.remove("active"));
    slides[index].classList.add("active");
}

document.getElementById("nextSlide").onclick = () => {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
};

document.getElementById("prevSlide").onclick = () => {
    currentSlide = (currentSlide - 1 + slides.length) % slides.length;
    showSlide(currentSlide);
};

// Auto slide
setInterval(() => {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
}, 5000);

// MOBILE NAV TOGGLE
const hamburger = document.getElementById("hamburger");
const navMenu = document.querySelector(".nav-menu");
const closeMenu = document.getElementById("closeMenu");

// OPEN MENU
hamburger.addEventListener("click", () => {
    navMenu.classList.add("active");
});

// CLOSE MENU
closeMenu.addEventListener("click", () => {
    navMenu.classList.remove("active");
});

//for login 
document.addEventListener("DOMContentLoaded", async () => {

    const userText = document.getElementById("userText")
    const userTrigger = document.getElementById("userTrigger")
    const adminPanelLink = document.getElementById("adminPanelLink")

    let isLoggedIn = false

    // check auth from backend
    try {
        const res = await fetch(`${BASE_URL}/auth/me`, {
            credentials: "include"
        })

        const data = await res.json()
        if (data.isLoggedIn) {
            isLoggedIn = true,
            userText.textContent = "Account"

            // role check
            if(data.user.role === "admin") {
                adminPanelLink.style.display = "inline-flex"
            }

        } else {
            userText.textContent = "Login"
        }
    } catch (err) {
        console.error(err)
        userText.textContent = "Login"
    }

    // click behavior
    userTrigger.addEventListener("click", (e) => {
        e.stopPropagation()

        if (!isLoggedIn) {
            window.location.href = "/auth/signin"
        } else {
            window.location.href = "/account"
        }
    })

    adminPanelLink.addEventListener("click", (e) => {
        e.preventDefault()
        window.open("/admin/admin-panel", "_blank")
    })
});

// Mobile search open
document.getElementById("mobileSearchBtn")?.addEventListener("click", () => {
    document.getElementById("searchInput")?.focus();
});