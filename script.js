// ===== SCROLL ANIMATIONS =====

// Intersection Observer for scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            // Don't unobserve - keep tracking for repeat scrolls
        } else {
            entry.target.classList.remove('in-view');
        }
    });
}, observerOptions);

// Observe all animation elements
document.querySelectorAll('.fade-in, .fade-in-up, .fade-in-left, .fade-in-right').forEach(el => {
    observer.observe(el);
});

// Add in-view styles
const style = document.createElement('style');
style.textContent = `
    .fade-in.in-view,
    .fade-in-up.in-view,
    .fade-in-left.in-view,
    .fade-in-right.in-view {
        animation-play-state: running !important;
    }
`;
document.head.appendChild(style);

// ===== SMOOTH SCROLL ENHANCEMENT =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ===== NAVBAR STYLE ON SCROLL =====
let lastScrollTop = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    let currentScroll = window.pageYOffset;

    // Add shadow on scroll
    if (currentScroll > 50) {
        navbar.style.borderBottomColor = 'rgba(0, 217, 255, 0.2)';
        navbar.style.boxShadow = '0 0 20px rgba(0, 217, 255, 0.1)';
    } else {
        navbar.style.borderBottomColor = 'rgba(0, 217, 255, 0.1)';
        navbar.style.boxShadow = 'none';
    }

    lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
});

// ===== PARALLAX EFFECT =====
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const heroBackground = document.querySelector('.hero-background');

    if (heroBackground) {
        heroBackground.style.transform = `translateY(${scrolled * 0.5}px)`;
    }
});

// ===== ACTIVE NAV LINK =====
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');

    let current = '';

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;

        if (scrollY >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').slice(1) === current) {
            link.classList.add('active');
        }
    });
});

// Add active state styling
const activeStyle = document.createElement('style');
activeStyle.textContent = `
    .nav-link.active {
        color: var(--cyan-bright);
    }

    .nav-link.active::after {
        width: 100%;
    }
`;
document.head.appendChild(activeStyle);

// ===== PERFORMANCE: LAZY LOAD VIDEOS =====
const videos = document.querySelectorAll('video');

const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.play().catch(() => {
                // Video might be blocked, that's okay
            });
        } else {
            entry.target.pause();
        }
    });
}, { threshold: 0.25 });

videos.forEach(video => {
    videoObserver.observe(video);
});

// ===== CTA BUTTON INTERACTIONS =====
const ctaButtons = document.querySelectorAll('.cta-button, .btn-primary, .btn-secondary');

ctaButtons.forEach(button => {
    button.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-3px)';
    });

    button.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });

    button.addEventListener('click', function(e) {
        // Add ripple effect
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');

        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    });
});

// Ripple effect styles
const rippleStyle = document.createElement('style');
rippleStyle.textContent = `
    .btn, .cta-button {
        position: relative;
        overflow: hidden;
    }

    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
    }

    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(rippleStyle);

// ===== AGENT CARD HOVER EFFECTS =====
const agentCards = document.querySelectorAll('.agent-card');

agentCards.forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
    });
});

// ===== PAGE LOAD ANIMATION =====
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});

// ===== SCROLL TO TOP BUTTON =====
let scrollToTopBtn = document.querySelector('.scroll-to-top');

if (!scrollToTopBtn) {
    scrollToTopBtn = document.createElement('button');
    scrollToTopBtn.classList.add('scroll-to-top');
    scrollToTopBtn.innerHTML = '↑';
    scrollToTopBtn.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #00d9ff 0%, #33e5ff 100%);
        color: #001a33;
        border: none;
        border-radius: 50%;
        font-size: 1.5rem;
        font-weight: bold;
        cursor: pointer;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        z-index: 999;
        box-shadow: 0 0 20px rgba(0, 217, 255, 0.4);
    `;
    document.body.appendChild(scrollToTopBtn);
}

window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
        scrollToTopBtn.style.opacity = '1';
        scrollToTopBtn.style.visibility = 'visible';
    } else {
        scrollToTopBtn.style.opacity = '0';
        scrollToTopBtn.style.visibility = 'hidden';
    }
});

scrollToTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

scrollToTopBtn.addEventListener('mouseenter', function() {
    this.style.transform = 'scale(1.1)';
});

scrollToTopBtn.addEventListener('mouseleave', function() {
    this.style.transform = 'scale(1)';
});

// ===== INITIALIZATION =====
console.log('Meridian Intelligence - Scrolling Website Initialized');
console.log('Ready for Higgsfield MCP video integration');
