    // Apply dark background for body
    if (document && document.body) {
      document.body.style.background = '#000000';
    }

    // Enable wheel-based paging (Rabbit R1 scrollwheel emits wheel events)
    let wheelLock = false;
    const onWheel = (e) => {
      // Prevent default to avoid native scroll
      e.preventDefault();
      if (wheelLock) return;
      wheelLock = true;
      const dir = Math.sign(e.deltaY);
      if (dir > 0) {
        window.setPage((typeof currentPage!=='undefined'? currentPage:1) + 1);
      } else if (dir < 0) {
        window.setPage((typeof currentPage!=='undefined'? currentPage:1) - 1);
      }
      // Small cooldown to avoid skipping many pages per tick
      setTimeout(() => { wheelLock = false; }, 180);
    };
    // Attach to whole document; use passive:false so preventDefault works
    window.addEventListener('wheel', onWheel, { passive: false });

    // If Rabbit R1 exposes a custom API/event, hook it here (no-op fallback)
    if (window.rabbit && typeof window.rabbit.onScroll === 'function') {
      window.rabbit.onScroll((delta) => {
        const dir = Math.sign(delta);
        if (dir > 0) window.setPage((typeof currentPage!=='undefined'? currentPage:1) + 1);
        else if (dir < 0) window.setPage((typeof currentPage!=='undefined'? currentPage:1) - 1);
      });
    }
  });
})();
