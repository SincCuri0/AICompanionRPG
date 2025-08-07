import { ref, computed, onMounted, onUnmounted, watch, Ref } from 'vue';
import { GENRES } from '../ai-data';
import { Genre } from '../ai-data-types';
import type { useAdventureState } from './useAdventureState'; // For type inference

type AdventureState = ReturnType<typeof useAdventureState>;

export function useAppUI(state: AdventureState) {
    const { selectedGenre, isGameScreenActive, resetFullAdventureState: _resetFullAdventureState } = state;

    const showShareModal = ref<boolean>(false); // Button to trigger this is currently removed
    const showRawModal = ref<boolean>(false);   // Button to trigger this is currently removed
    const isCopied = ref<boolean>(false);
    const isSmallScreen = ref(window.innerWidth < 1024);
    const forceShowBottomMessage = ref(false);
    const showMobileSidebar = ref<boolean>(false); // New state for mobile sidebar

    // Companion panel needs more space - only show on larger screens
    const shouldShowCompanionPanel = ref(window.innerWidth >= 1400);

    const resetFullAdventureState = () => _resetFullAdventureState(isSmallScreen.value);


    const currentShareUrl = computed(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams();
            if (selectedGenre.value) params.set('genre', selectedGenre.value);
            return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
        }
        return '';
    });

    const copyShareUrl = async () => {
        try {
            await navigator.clipboard.writeText(currentShareUrl.value);
            isCopied.value = true;
            setTimeout(() => isCopied.value = false, 2000);
        } catch (err) {
            console.error('Failed to copy URL: ', err);
            alert('Failed to copy URL. Please try manually.');
        }
    };

    const checkUrlParams = () => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const genreFromUrl = params.get('genre') as Genre;
            if (genreFromUrl && GENRES.includes(genreFromUrl)) {
                selectedGenre.value = genreFromUrl;
            }
        }
    };

    const handleResize = () => {
        const oldIsSmallScreen = isSmallScreen.value;
        isSmallScreen.value = window.innerWidth < 1024;
        shouldShowCompanionPanel.value = window.innerWidth >= 1400;

        if (oldIsSmallScreen && !isSmallScreen.value && showMobileSidebar.value) {
            showMobileSidebar.value = false; // Close mobile sidebar if screen becomes large
        }

        if (!isSmallScreen.value && isGameScreenActive.value) {
            document.body.style.overflow = 'hidden';
        } else if (isSmallScreen.value && !isGameScreenActive.value) {
            document.body.style.overflow = 'auto';
        } else if (isSmallScreen.value && isGameScreenActive.value) {
             document.body.style.overflow = 'hidden'; // Keep hidden if game is active on small screen
        } else {
            document.body.style.overflow = 'auto'; // Default for selection screen on large screen
        }
    };
    
    watch(isGameScreenActive, (newVal) => {
        console.log("[AppUI] isGameScreenActive changed to:", newVal);
        if (newVal) {
            if(isSmallScreen.value) document.body.style.overflow = 'hidden';
            else document.body.style.overflow = 'hidden'; // Also hide for large screen game active
        } else {
            document.body.style.overflow = 'auto'; 
            showMobileSidebar.value = false; // Close sidebar when exiting game screen
        }
    });

    onMounted(() => {
        console.log("[AppUI] Component mounted logic running.");
        checkUrlParams();
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial call
    });

    onUnmounted(() => {
        console.log("[AppUI] Component unmounted logic running.");
        window.removeEventListener('resize', handleResize);
    });

    return {
        showShareModal,
        showRawModal,
        isCopied,
        currentShareUrl,
        copyShareUrl,
        // showClickToRestartHelp, // Removed
        isSmallScreen,
        shouldShowCompanionPanel,
        forceShowBottomMessage,
        showMobileSidebar, // Exposed for template use
    };
}
