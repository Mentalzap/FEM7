// Globale variabelen
const ADMIN_HASH = CryptoJS.SHA256('admin123').toString(); // Hashed wachtwoord (NB: voor productie naar server-side verplaatsen)
let isLoggedIn = false;

// Helper Functions
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

const escapeHtml = (unsafe) => unsafe.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

// NewsManager Class
class NewsManager {
    constructor() {
        this.newsItems = [];
        this.currentIndex = 0;
        this.itemsPerView = window.innerWidth > 768 ? 3 : window.innerWidth > 500 ? 2 : 1;
        this.isDragging = false;
        this.startPos = 0;
        this.currentTranslate = 0;
        this.prevTranslate = 0;

        // DOM Elements
        this.container = document.querySelector('.news-container');
        this.wrapper = document.querySelector('.news-wrapper');
        this.form = document.getElementById('newsForm');
        this.prevBtn = document.querySelector('.slider-button.prev');
        this.nextBtn = document.querySelector('.slider-button.next');
        this.pagination = document.querySelector('.slider-pagination');

        this.init();
    }

    init() {
        this.loadNewsItems();
        this.setupSlider();
        this.setupEventListeners();
        this.updateNewsDisplay();
        this.createPagination();
        this.updateSliderControls();
    }

    setupSlider() {
        if (!this.container || !this.wrapper) return;
        this.container.style.overflow = 'hidden';
        this.wrapper.style.display = 'flex';
        this.wrapper.style.transition = 'transform 0.3s ease-in-out';
    }

    setupEventListeners() {
        if (!this.wrapper) return;

        this.form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addNewsItem();
        });

        this.prevBtn?.addEventListener('click', () => this.slide('prev'));
        this.nextBtn?.addEventListener('click', () => this.slide('next'));

        this.wrapper.addEventListener('touchstart', (e) => this.touchStart(e));
        this.wrapper.addEventListener('touchmove', (e) => this.touchMove(e));
        this.wrapper.addEventListener('touchend', () => this.touchEnd());

        this.wrapper.addEventListener('mousedown', (e) => this.touchStart(e));
        this.wrapper.addEventListener('mousemove', (e) => this.touchMove(e));
        this.wrapper.addEventListener('mouseup', () => this.touchEnd());
        this.wrapper.addEventListener('mouseleave', () => this.touchEnd());

        window.addEventListener('resize', debounce(() => {
            this.itemsPerView = window.innerWidth > 768 ? 3 : window.innerWidth > 500 ? 2 : 1;
            this.updateNewsDisplay();
            this.updateSliderControls();
        }, 250));
    }

    touchStart(event) {
        this.isDragging = true;
        this.startPos = this.getPositionX(event);
        this.wrapper.style.cursor = 'grabbing';
    }

    touchMove(event) {
        if (!this.isDragging) return;
        const currentPosition = this.getPositionX(event);
        this.currentTranslate = this.prevTranslate + currentPosition - this.startPos;
        this.setSliderPosition();
    }

    touchEnd() {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.wrapper.style.cursor = 'grab';

        const movedBy = this.currentTranslate - this.prevTranslate;
        if (Math.abs(movedBy) > 50) {
            this.slide(movedBy < 0 ? 'next' : 'prev');
        } else {
            this.snapToPosition();
        }
    }

    getPositionX(event) {
        return event.type.includes('mouse') ? event.pageX : event.touches[0].clientX;
    }

    setSliderPosition() {
        this.wrapper.style.transform = `translateX(${this.currentTranslate}px)`;
    }

    snapToPosition() {
        const itemWidth = this.wrapper.children[0]?.offsetWidth || 0;
        const nearestIndex = Math.round(Math.abs(this.currentTranslate / (itemWidth + 20))); // 20px gap
        this.goToSlide(nearestIndex);
    }

    slide(direction) {
        const itemWidth = this.wrapper.children[0]?.offsetWidth || 0;
        const maxIndex = Math.max(0, this.newsItems.length - this.itemsPerView);
        this.currentIndex = direction === 'prev'
            ? Math.max(0, this.currentIndex - 1)
            : Math.min(maxIndex, this.currentIndex + 1);
        this.currentTranslate = -this.currentIndex * (itemWidth + 20); // 20px gap
        this.prevTranslate = this.currentTranslate;
        this.setSliderPosition();
        this.updateSliderControls();
        this.updatePagination();
    }

    goToSlide(index) {
        const itemWidth = this.wrapper.children[0]?.offsetWidth || 0;
        this.currentIndex = Math.min(Math.max(0, index), this.newsItems.length - this.itemsPerView);
        this.currentTranslate = -this.currentIndex * (itemWidth + 20); // 20px gap
        this.prevTranslate = this.currentTranslate;
        this.setSliderPosition();
        this.updateSliderControls();
        this.updatePagination();
    }

    createPagination() {
        if (!this.pagination) return;
        const totalPages = Math.ceil(this.newsItems.length / this.itemsPerView);
        this.pagination.innerHTML = Array.from({ length: totalPages }, (_, index) => `
            <button class="pagination-dot${index === this.currentIndex ? ' active' : ''}" 
                    onclick="window.newsManagerInstance.goToSlide(${index})" 
                    aria-label="Ga naar slide ${index + 1}"></button>
        `).join('');
    }

    updatePagination() {
        if (!this.pagination) return;
        this.pagination.querySelectorAll('.pagination-dot').forEach((dot, index) => {
            dot.classList.toggle('active', index === this.currentIndex);
        });
    }

    loadNewsItems() {
        this.newsItems = JSON.parse(localStorage.getItem('newsItems')) || [];
    }

    saveNewsItems() {
        localStorage.setItem('newsItems', JSON.stringify(this.newsItems));
    }

    addNewsItem() {
        const title = document.getElementById('newsTitle')?.value;
        const content = document.getElementById('newsContent')?.value;
        const image = document.getElementById('newsImage')?.files[0];
        const date = document.getElementById('newsDate')?.value;
        const idField = document.getElementById('newsId');
        const id = idField?.value ? parseInt(idField.value) : null;

        if (!title || !content || !date) {
            showNotification('Vul alle verplichte velden in (titel, inhoud, datum).', 'error');
            return;
        }

        const newItem = { id: id || Date.now(), title, content, date };

        if (image) {
            const reader = new FileReader();
            reader.onload = () => {
                newItem.image = reader.result;
                this.finishAddingNewsItem(newItem, id);
            };
            reader.readAsDataURL(image);
        } else {
            this.finishAddingNewsItem(newItem, id);
        }
    }

    finishAddingNewsItem(newItem, id) {
        if (id) {
            const index = this.newsItems.findIndex(item => item.id === id);
            if (index !== -1) this.newsItems[index] = newItem;
        } else {
            this.newsItems.unshift(newItem);
        }
        this.saveNewsItems();
        this.updateNewsDisplay();
        this.resetForm();
        showNotification('Nieuwsitem succesvol gepubliceerd');
    }

    editNewsItem(id) {
        const item = this.newsItems.find(item => item.id === id);
        if (item) {
            document.getElementById('newsId').value = item.id;
            document.getElementById('newsTitle').value = item.title;
            document.getElementById('newsContent').value = item.content;
            document.getElementById('newsDate').value = item.date;
        }
    }

    deleteNewsItem(id) {
        if (!confirm('Weet je zeker dat je dit artikel wilt verwijderen?')) return;
        this.newsItems = this.newsItems.filter(item => item.id !== id);
        this.saveNewsItems();
        this.updateNewsDisplay();
        if (isLoggedIn) updateAdminNewsDisplay();
    }

    resetForm() {
        this.form?.reset();
        document.getElementById('newsId').value = '';
    }

    updateNewsDisplay() {
        if (!this.wrapper) return;
        this.wrapper.innerHTML = this.newsItems.map(item => this.createNewsItemHTML(item)).join('');
        this.createPagination();
        this.updateSliderControls();
        if (isLoggedIn) updateAdminNewsDisplay();
    }

    createNewsItemHTML(item) {
        return `
            <article class="news-item" role="listitem">
                <header class="news-item-header">
                    <h3 class="news-item-title">${escapeHtml(item.title)}</h3>
                    <time class="news-item-date" datetime="${item.date}">
                        ${new Date(item.date).toLocaleDateString('nl-NL')}
                    </time>
                </header>
                <div class="news-item-content">
                    <p>${escapeHtml(item.content.slice(0, 100))} ${item.content.length > 100 ? '...' : ''}</p>
                    ${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.title)}" style="max-width: 100%;" loading="lazy">` : ''}
                    ${item.content.length > 100 ? `<button class="btn btn-primary read-more" onclick="showNewsModal(${item.id})">Lees meer</button>` : ''}
                </div>
            </article>
        `;
    }

    updateSliderControls() {
        if (!this.prevBtn || !this.nextBtn) return;
        const maxIndex = Math.max(0, this.newsItems.length - this.itemsPerView);
        this.prevBtn.disabled = this.currentIndex <= 0;
        this.nextBtn.disabled = this.currentIndex >= maxIndex;
    }
}

// Admin Authentication & Content Management
function login(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const hashedPassword = CryptoJS.SHA256(password).toString();
    if (username === 'admin' && hashedPassword === ADMIN_HASH) {
        isLoggedIn = true;
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        loadCurrentContent();
        updateAdminNewsDisplay();
    } else {
        showNotification('Ongeldige inloggegevens', 'error');
    }
}

function logout() {
    isLoggedIn = false;
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function cancelLogin() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function loadCurrentContent() {
    const headingSections = ['section1', 'section2', 'section3', 'news', 'contact'];
    headingSections.forEach(section => {
        const headingElement = document.querySelector(`#${section} .content h1`) || document.querySelector(`#${section} .content h2`);
        const headingInput = document.getElementById(`${section}Heading`);
        if (headingElement && headingInput) headingInput.value = headingElement.textContent;
    });
}

function updateHeading(section, tag) {
    const inputField = document.getElementById(`${section}Heading`);
    const targetElement = document.querySelector(`#${section} .content ${tag}`);
    if (inputField?.value && targetElement) {
        if (confirm('Weet je zeker dat je deze kop wilt bijwerken?')) {
            targetElement.textContent = inputField.value;
            inputField.value = '';
            showNotification('Koptekst succesvol bijgewerkt');
        }
    } else {
        showNotification('Er is iets misgegaan bij het bijwerken van de koptekst.', 'error');
    }
}

function updateBackground(sectionId) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                document.querySelector(`#${sectionId} .bg-layer`).style.backgroundImage = `url(${reader.result})`;
                showNotification('Achtergrond succesvol bijgewerkt');
            };
            reader.readAsDataURL(file);
        }
    };
    fileInput.click();
}

function previewNews() {
    const title = document.getElementById('newsTitle')?.value || 'Geen titel';
    const content = document.getElementById('newsContent')?.value || 'Geen inhoud';
    const image = document.getElementById('newsImage')?.files[0];
    let previewHTML = `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(content)}</p>`;
    if (image) {
        const imgUrl = URL.createObjectURL(image);
        previewHTML += `<img src="${imgUrl}" alt="Preview afbeelding" style="max-width: 100%;">`;
    }
    const previewWindow = window.open('', 'Preview', 'width=600,height=400');
    previewWindow.document.write(previewHTML);
}

function filterNews() {
    const searchTerm = document.getElementById('newsSearch')?.value.toLowerCase() || '';
    const newsItems = document.querySelectorAll('#existingNews .news-item');
    newsItems.forEach(item => {
        const title = item.querySelector('.news-item-title')?.textContent.toLowerCase() || '';
        item.style.display = title.includes(searchTerm) ? 'block' : 'none';
    });
}

function updateAdminNewsDisplay() {
    const adminContainer = document.getElementById('existingNews');
    if (!adminContainer || !window.newsManagerInstance) return;
    adminContainer.innerHTML = window.newsManagerInstance.newsItems.map(item => adminNewsItemHTML(item)).join('');
}

function adminNewsItemHTML(item) {
    return `
        <article class="news-item" role="listitem">
            <header class="news-item-header">
                <h3 class="news-item-title">${escapeHtml(item.title)}</h3>
                <time class="news-item-date" datetime="${item.date}">
                    ${new Date(item.date).toLocaleDateString('nl-NL')}
                </time>
            </header>
            <div class="news-item-content">
                <p>${escapeHtml(item.content)}</p>
                ${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.title)}" style="max-width: 100%;">` : ''}
            </div>
            <footer class="news-item-footer">
                <div class="admin-controls">
                    <button type="button" onclick="window.newsManagerInstance.editNewsItem(${item.id})">Bewerk</button>
                    <button type="button" onclick="window.newsManagerInstance.deleteNewsItem(${item.id})">Verwijder</button>
                </div>
            </footer>
        </article>
    `;
}

// News Modal
function showNewsModal(id) {
    const item = window.newsManagerInstance.newsItems.find(item => item.id === id);
    if (!item) return;

    const modal = document.createElement('div');
    modal.className = 'news-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>${escapeHtml(item.title)}</h2>
            <time datetime="${item.date}">${new Date(item.date).toLocaleDateString('nl-NL')}</time>
            <p>${escapeHtml(item.content)}</p>
            ${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.title)}" style="max-width: 100%;">` : ''}
            <button class="btn btn-secondary" onclick="this.parentElement.parentElement.remove()">Sluiten</button>
        </div>
    `;
    document.body.appendChild(modal);
}

// Scroll Effects en Parallax
function initializeScrollEffects() {
    const contents = document.querySelectorAll('.content');
    const sections = document.querySelectorAll('.content-section[data-bg]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            entry.target.classList.toggle('visible', entry.isIntersecting);
            entry.target.querySelectorAll('.service-item').forEach(item => {
                item.classList.toggle('visible', entry.isIntersecting);
            });
        });
    }, { threshold: 0.2 });

    contents.forEach(content => {
        observer.observe(content);
        if (content.closest('#news')) content.classList.add('visible');
    });

    const updateParallax = () => {
        sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            const offset = rect.top / window.innerHeight;
            section.style.setProperty('--scroll-offset', offset);
            section.classList.toggle('parallax', rect.top < window.innerHeight && rect.bottom > 0);
        });
    };
    window.addEventListener('scroll', debounce(updateParallax, 10), { passive: true });
    updateParallax();
}

// Notifications
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// DOMContentLoaded: Initialization
document.addEventListener('DOMContentLoaded', () => {
    window.newsManagerInstance = new NewsManager();
    initializeScrollEffects();

    // Contactformulier validatie en verzending
    document.getElementById('contactForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('contactName').value.trim();
        const email = document.getElementById('contactEmail').value.trim();
        const message = document.getElementById('contactMessage').value.trim();

        if (!/^[a-zA-Z\s]+$/.test(name)) {
            showNotification('Voer een geldige naam in (alleen letters).', 'error');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showNotification('Voer een geldig e-mailadres in.', 'error');
            return;
        }
        if (message.length < 10) {
            showNotification('Bericht moet minimaal 10 tekens bevatten.', 'error');
            return;
        }

        console.log({ name, email, message }); // Later naar backend sturen
        showNotification('Bericht succesvol verzonden!');
        e.target.reset();
    });

    // Admin login trigger
    document.getElementById('hidden-seven')?.addEventListener('click', () => {
        if (!isLoggedIn) {
            document.getElementById('loginModal').style.display = 'block';
        }
    });

    // Dienst-items uitklappen
    document.querySelectorAll('.service-item').forEach(item => {
        item.addEventListener('click', function() {
            const isActive = this.classList.contains('active');
            this.classList.toggle('active', !isActive);
            this.setAttribute('aria-expanded', !isActive);
        });
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.click();
            }
        });
    });
});