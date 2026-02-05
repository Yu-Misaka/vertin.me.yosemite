/**
 * PureSuck View Transitions
 * 
 * 基于 Astro View Transitions API 的页面过渡动画
 * 替代 swup 库，精简代码同时保持动画效果
 */

(function() {
    'use strict';

    // ==================== 页面类型定义 ====================
    const PageType = {
        LIST: 'list',   // 首页、分类页、标签页、搜索页
        POST: 'post',   // 文章详情页
        PAGE: 'page'    // 独立页面（关于、友链、归档等）
    };

    // ==================== 全局状态 ====================
    const STATE = {
        lastPost: {
            key: null,
            fromSingle: false
        },
        lastNavigation: {
            fromType: null,
            toType: null
        }
    };

    // ==================== View Transitions 配置 ====================
    const VT = {
        markerAttr: 'data-ps-vt-name',
        duration: 380,
        markerSelector: '[data-ps-vt-name]'
    };

    // ==================== 动画配置 ====================
    const ANIM = {
        enter: {
            post: { duration: 380, stagger: 40, y: 16, maxItems: 24 },
            list: { duration: 520, stagger: 65, y: 48, maxItems: 20 },
            page: {
                card: { duration: 380, y: 40, scale: 0.98 },
                inner: { duration: 380, stagger: 40, y: 16, maxItems: 24 }
            }
        }
    };

    // ==================== 工具函数 ====================
    function prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function getPageType() {
        const root = document.getElementById('swup');
        const dataType = root?.dataset?.psPageType || '';
        if (dataType === 'post') return PageType.POST;
        if (dataType === 'page') return PageType.PAGE;
        return PageType.LIST;
    }

    function getSwupRoot() {
        return document.getElementById('swup') || document;
    }

    function getPostKeyFromElement(el) {
        return el?.dataset?.psPostKey || el?.getAttribute('data-ps-post-key') || null;
    }

    function rememberLastPostKey(postKey) {
        if (!postKey) return;
        const state = (history.state && typeof history.state === 'object') ? history.state : {};
        if (state.lastPostKey === postKey) return;
        history.replaceState({ ...state, lastPostKey: postKey }, document.title);
        STATE.lastPost.key = postKey;
    }

    // ==================== VT 名称管理 ====================
    function getElementVTName(type, postKey) {
        const safeKey = encodeURIComponent(String(postKey)).replace(/%/g, '_');
        return `ps-post-${safeKey}`;
    }

    let _currentVTElements = { container: null };

    function clearAllVTNames() {
        let hasTracked = false;
        for (const type in _currentVTElements) {
            const el = _currentVTElements[type];
            if (el) {
                hasTracked = true;
                el.style.viewTransitionName = '';
                el.removeAttribute(VT.markerAttr);
                _currentVTElements[type] = null;
            }
        }
        if (!hasTracked) {
            const elements = document.querySelectorAll(VT.markerSelector);
            for (let i = 0; i < elements.length; i++) {
                elements[i].style.viewTransitionName = '';
                elements[i].removeAttribute(VT.markerAttr);
            }
        }
    }

    function applyMultiVTNames(cardEl, postKey) {
        if (!cardEl || !postKey) return;
        if (_currentVTElements.container === cardEl) {
            const existingName = cardEl.style.viewTransitionName;
            const expectedName = getElementVTName('container', postKey);
            if (existingName === expectedName) return;
        }
        clearAllVTNames();
        const name = getElementVTName('container', postKey);
        cardEl.style.viewTransitionName = name;
        cardEl.setAttribute(VT.markerAttr, name);
        _currentVTElements.container = cardEl;
    }

    function syncPostMultiVTNames() {
        const container = document.querySelector('.post.post--single');
        let postKey = getPostKeyFromElement(container)
                    || history.state?.lastPostKey
                    || STATE.lastPost.key;
        if (!postKey || !container) return;
        rememberLastPostKey(postKey);
        const name = getElementVTName('container', postKey);
        container.style.viewTransitionName = name;
        container.setAttribute(VT.markerAttr, name);
        _currentVTElements.container = container;
    }

    function findIndexPostCardById(postKey) {
        if (!postKey) return null;
        const root = getSwupRoot();
        const cards = root.querySelectorAll('.post.post--index');
        for (let i = 0; i < cards.length; i++) {
            const cardKey = getPostKeyFromElement(cards[i]);
            if (cardKey === postKey) return cards[i];
        }
        return null;
    }

    // ==================== 动画类管理 ====================
    const EXIT_CLASSES = ['ps-list-exit', 'ps-post-exit', 'ps-page-exit'];
    const ENTER_CLASSES = ['ps-list-enter', 'ps-post-enter', 'ps-page-enter'];
    const PRELOAD_CLASSES = ['ps-preload-list-enter', 'ps-preload-post-enter', 'ps-preload-page-enter'];

    function toExitClass(type) {
        if (type === 'post') return 'ps-post-exit';
        if (type === 'page') return 'ps-page-exit';
        return 'ps-list-exit';
    }

    function toEnterClass(type) {
        if (type === 'post') return 'ps-post-enter';
        if (type === 'page') return 'ps-page-enter';
        return 'ps-list-enter';
    }

    function clearClasses(list) {
        const html = document.documentElement;
        list.forEach((name) => html.classList.remove(name));
    }

    function cleanupAnimationClasses() {
        document.documentElement.classList.remove(
            'ps-animating',
            'ps-exit-active',
            'ps-enter-active',
            'ps-page-exit',
            'ps-page-enter',
            'ps-post-exit',
            'ps-post-enter',
            'ps-list-exit',
            'ps-list-enter',
            'ps-pre-enter'
        );
        const swupRoot = getSwupRoot();
        swupRoot.querySelectorAll('.ps-enter-hidden-list, .ps-enter-hidden-post, .ps-enter-hidden-page-card, .ps-enter-hidden-page-inner')
            .forEach(el => {
                el.classList.remove(
                    'ps-enter-hidden-list',
                    'ps-enter-hidden-post',
                    'ps-enter-hidden-page-card',
                    'ps-enter-hidden-page-inner'
                );
            });
        setTimeout(() => {
            document.documentElement.classList.remove('ps-vt-mode');
            getSwupRoot().classList.remove('ps-vt-mode');
        }, VT.duration + 50);
    }

    // ==================== 收集动画目标 ====================
    function collectPostEnterTargets() {
        const scope = getSwupRoot();
        const postBody = scope.querySelector('.post.post--single .post-body');
        if (!postBody) return [];
        const selector = '.post-meta, .post-content > *, .protected-block, .license-info-card';
        const targets = Array.from(postBody.querySelectorAll(selector)).slice(0, ANIM.enter.post.maxItems);
        const commentsRoot = scope.querySelector('.post.post--single .post-comments');
        if (commentsRoot) {
            const commentsSelector = '#comments-list > .comment-title, #comments-list li, #comments-list > .page-navigator, #comments > .respond';
            targets.push(...Array.from(commentsRoot.querySelectorAll(commentsSelector)).slice(0, 8));
        }
        const pager = scope.querySelector('.main-pager');
        if (pager) targets.push(pager);
        return targets.slice(0, ANIM.enter.post.maxItems);
    }

    function collectPageEnterTargets() {
        const scope = getSwupRoot();
        const main = scope.querySelector('main.main') || scope;
        const pageArticle = main.querySelector('.post.post--index.main-item:not(.post--single)');
        if (!pageArticle) return { card: null, inner: [] };
        const innerTargets = [];
        const postBody = pageArticle.querySelector('.post-body');
        if (postBody) {
            const title = postBody.querySelector('.post-title');
            if (title) innerTargets.push(title);
            const meta = postBody.querySelector('.post-meta');
            if (meta) innerTargets.push(meta);
            const innerWrapper = postBody.querySelector('.inner-post-wrapper');
            if (innerWrapper) {
                innerTargets.push(...Array.from(innerWrapper.children).filter(c => c !== meta));
            }
        }
        const pager = scope.querySelector('.main-pager');
        if (pager) innerTargets.push(pager);
        return { card: pageArticle, inner: innerTargets.slice(0, ANIM.enter.page.inner.maxItems) };
    }

    function collectListEnterTargets() {
        const scope = getSwupRoot();
        const main = scope.querySelector('main.main') || scope;
        const wrapper = main.querySelector('.wrapper') || main;
        const targets = [];
        const archiveTitle = wrapper.querySelector('.archive-title');
        if (archiveTitle) targets.push(archiveTitle);
        if (wrapper.children?.length) {
            for (const child of wrapper.children) {
                if (child?.classList?.contains('post') && child.classList.contains('post--index')) {
                    targets.push(child);
                }
            }
        } else {
            targets.push(...Array.from(wrapper.querySelectorAll('.post.post--index')));
        }
        const pager = main.querySelector('.main-pager');
        if (pager) targets.push(pager);
        const lastInfo = main.querySelector('.main-lastinfo');
        if (lastInfo) targets.push(lastInfo);
        const vtMarker = main.querySelector(VT.markerSelector);
        const vtEl = vtMarker?.closest('.post');
        const filtered = targets.filter(el => el !== vtEl);
        return filtered.slice(0, ANIM.enter.list.maxItems);
    }

    // ==================== 进入动画 ====================
    async function animateLightEnter(targets, baseDelay = 0, options = {}) {
        if (!targets?.length || prefersReducedMotion()) return;
        const { duration = 380, stagger = 32, y = 16, scale = 1, easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)' } = options;
        const hasScale = scale !== 1;
        const keyframes = [
            { opacity: 0, transform: hasScale ? `translate3d(0,${y}px,0) scale(${scale})` : `translate3d(0,${y}px,0)` },
            { opacity: 1, transform: hasScale ? 'translate3d(0,0,0) scale(1)' : 'translate3d(0,0,0)' }
        ];
        const baseOpts = { duration, easing, fill: 'both' };
        
        for (let i = 0; i < targets.length; i++) {
            const el = targets[i];
            if (!el) continue;
            const anim = el.animate(keyframes, { ...baseOpts, delay: baseDelay + i * stagger });
            anim.onfinish = () => {
                el.style.opacity = '';
                el.style.transform = '';
            };
        }
    }

    async function runEnterAnimation(toType, hasSharedElement) {
        if (prefersReducedMotion()) return;
        const baseDelay = hasSharedElement ? Math.max(0, VT.duration - 100) : 0;

        if (toType === PageType.POST) {
            const targets = collectPostEnterTargets();
            await animateLightEnter(targets, baseDelay, ANIM.enter.post);
        } else if (toType === PageType.PAGE) {
            const pageTargets = collectPageEnterTargets();
            if (pageTargets.card) {
                await animateLightEnter([pageTargets.card], baseDelay, ANIM.enter.page.card);
            }
            if (pageTargets.inner.length > 0) {
                await animateLightEnter(pageTargets.inner, baseDelay + ANIM.enter.page.card.duration + 60, ANIM.enter.page.inner);
            }
        } else if (toType === PageType.LIST) {
            const targets = collectListEnterTargets();
            await animateLightEnter(targets, baseDelay, ANIM.enter.list);
        }
    }

    // ==================== 共享元素同步 ====================
    function syncPostSharedElementFromLocation() {
        const pageType = getPageType();
        if (pageType === PageType.POST) {
            syncPostMultiVTNames();
            return;
        }
        if (pageType === PageType.LIST) {
            const lastKey = STATE.lastPost.key || history.state?.lastPostKey;
            if (lastKey) {
                const card = findIndexPostCardById(lastKey);
                if (card) {
                    applyMultiVTNames(card, lastKey);
                    return;
                }
            }
        }
        clearAllVTNames();
    }

    function presetViewTransitionNames() {
        const pageType = getPageType();
        if (pageType === PageType.POST) {
            syncPostMultiVTNames();
        } else if (pageType === PageType.LIST) {
            const lastKey = history.state?.lastPostKey || STATE.lastPost.key;
            if (lastKey) {
                const card = findIndexPostCardById(lastKey);
                if (card) applyMultiVTNames(card, lastKey);
            }
        }
    }

    // ==================== 主题切换 ====================
    function ensureThemeToggle() {
        if (typeof window.toggleTheme === 'function') return;
        window.toggleTheme = function () {
            const root = document.documentElement;
            const current = root.getAttribute('data-theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            
            if (document.startViewTransition) {
                root.classList.add('ps-theme-vt');
                document.startViewTransition(() => {
                    root.setAttribute('data-theme', next);
                }).finished.finally(() => {
                    root.classList.remove('ps-theme-vt');
                });
            } else {
                root.setAttribute('data-theme', next);
            }
            
            try {
                localStorage.setItem('theme', next);
                document.cookie = 'theme=' + next + '; path=/; max-age=31536000';
            } catch (e) {}
        };
    }

    // ==================== 事件处理 ====================
    function runEnter() {
        const html = document.documentElement;
        clearClasses(ENTER_CLASSES);
        clearClasses(PRELOAD_CLASSES);
        const pageType = getPageType();
        const cls = toEnterClass(pageType);
        html.classList.add(cls);
        
        // 同步VT元素
        syncPostSharedElementFromLocation();
        
        // 运行进入动画
        const hasSharedElement = Boolean(document.querySelector(VT.markerSelector));
        runEnterAnimation(pageType, hasSharedElement);
        
        setTimeout(() => {
            html.classList.remove(cls);
            cleanupAnimationClasses();
        }, 600);
    }

    function runExit() {
        const html = document.documentElement;
        const pageType = getPageType();
        STATE.lastNavigation.fromType = pageType;
        STATE.lastPost.fromSingle = pageType === PageType.POST;
        
        clearClasses(EXIT_CLASSES);
        const cls = toExitClass(pageType);
        html.classList.add(cls);
        html.classList.add('is-animating');
        
        const swup = document.getElementById('swup');
        if (swup) swup.classList.add('ps-vt-mode');
    }

    // ==================== 初始化模块 ====================
    function runModuleInit() {
        if (typeof window.NavIndicator?.update === 'function') {
            window.NavIndicator.update();
        }
        
        const currentPath = window.location.pathname;
        document.querySelectorAll('.header-nav .nav-item').forEach(item => {
            const link = item.querySelector('a');
            if (link) {
                const linkPath = new URL(link.href).pathname;
                item.classList.toggle('nav-item-current', linkPath === currentPath);
            }
        });
        
        if (typeof window.__psShortcodesInit === 'function') {
            window.__psShortcodesInit(document);
        }
        
        if (typeof window.LazyLoadManager !== 'undefined') {
            window.LazyLoadManager.observe(getSwupRoot());
        }
        
        window.OwoManager?.init();
    }

    // ==================== 点击事件处理 ====================
    document.addEventListener('click', (event) => {
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const link = event.target?.closest('a[href]');
        if (!link) return;
        if (link.target && link.target !== '_self') return;
        if (link.hasAttribute('download')) return;

        try {
            const url = new URL(link.href, window.location.origin);
            if (url.origin !== window.location.origin) return;
        } catch {
            return;
        }

        const postCard = link.closest('.post.post--index');
        if (!postCard) return;

        const postKey = getPostKeyFromElement(postCard);
        if (!postKey) return;

        rememberLastPostKey(postKey);
        applyMultiVTNames(postCard, postKey);

        if (typeof window.LazyLoadManager !== 'undefined') {
            window.LazyLoadManager.loadForVT(postCard);
        }
    }, true);

    // ==================== Astro 事件监听 ====================
    document.addEventListener('astro:before-preparation', () => {
        runExit();
    });

    document.addEventListener('astro:after-swap', () => {
        runEnter();
        runModuleInit();
    });

    document.addEventListener('astro:page-load', () => {
        runModuleInit();
    });

    // ==================== 初始加载 ====================
    function init() {
        ensureThemeToggle();
        presetViewTransitionNames();
        
        const pageType = getPageType();
        const preloadClasses = ['ps-preload-list-enter', 'ps-preload-post-enter', 'ps-preload-page-enter'];
        const hasPreloadClass = preloadClasses.some(cls => document.documentElement.classList.contains(cls));
        
        if (hasPreloadClass) {
            requestAnimationFrame(() => {
                preloadClasses.forEach(cls => document.documentElement.classList.remove(cls));
                const cls = toEnterClass(pageType);
                document.documentElement.classList.add(cls);
                
                requestAnimationFrame(() => {
                    runEnterAnimation(pageType, false);
                });
            });
            
            setTimeout(() => cleanupAnimationClasses(), 1000);
        } else {
            runEnterAnimation(pageType, false);
        }
        
        runModuleInit();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ==================== 导出给其他模块使用 ====================
    window.__psRunEnter = runEnter;
})();
