document.addEventListener("DOMContentLoaded", () => {
    // ================================
    // Cached DOM Elements
    // ================================
    
    // Upload Form Elements
    const uploadForm = document.getElementById("upload-form");
    const audioFileInput = document.getElementById("audio-file");
    const createTranscriptCheckbox = document.getElementById("create-transcript");
    const departmentSelect = document.getElementById("department");
    const languageDropdown = document.getElementById("languageDropdown");
    const languageMenu = document.getElementById("languageMenu");
    const languageCheckboxes = languageMenu.querySelectorAll('input[type="checkbox"]');
    
    // Filter Form Elements
    const filterForm = document.getElementById("filter-form");
    const departmentFilterDropdown = document.getElementById("departmentFilterDropdown");
    const departmentFilterMenu = document.getElementById("departmentFilterMenu");
    const departmentFilterCheckboxes = departmentFilterMenu.querySelectorAll('input[type="checkbox"]');
    
    const languageFilterDropdown = document.getElementById("languageFilterDropdown");
    const languageFilterMenu = document.getElementById("languageFilterMenu");
    const languageFilterCheckboxes = languageFilterMenu.querySelectorAll('input[type="checkbox"]');
    
    const filenameSearchInput = document.getElementById("filename-search");
    const clearFiltersButton = document.getElementById("clear-filters");
    
    // Recordings List Elements
    const recordingsList = document.getElementById("recordings-list");
    const prevPageButton = document.getElementById("prev-page");
    const nextPageButton = document.getElementById("next-page");
    
    // Audio Player and Transcript Elements
    const audioPlayer = document.getElementById("audio-player");
    const audioSource = document.getElementById("audio-source");
    const transcriptSection = document.getElementById("transcript");
    const copyTranscriptButton = document.getElementById("copy-transcript");
    
    // Pattern Generation Elements
    const patternSection = document.getElementById("pattern-section");
    const patternDropdown = document.getElementById("patternDropdown");
    const patternMenu = document.getElementById("patternMenu");
    const patternCheckboxes = patternMenu.querySelectorAll('input[type="checkbox"]');
    const generatePatternsButton = document.getElementById("generate-patterns");
    const patternResultsSection = document.getElementById("pattern-results-section");
    const patternResults = document.getElementById("pattern-results");
    const copyPatternsButton = document.getElementById("copy-patterns");
    
    // Popup Element for User Feedback
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.textContent = 'Copied!';
    document.body.appendChild(popup);
    
    // ================================
    // State Variables
    // ================================
    let currentPage = 1;
    const pageSize = 5;
    
    let currentFilters = {
        department: "",
        language: "",
        filename: ""
    };
    
    // ================================
    // Utility Functions
    // ================================
    
    /**
     * Toggles the visibility of a dropdown menu and updates its text based on selected checkboxes.
     * @param {HTMLElement} dropdown - The dropdown button element.
     * @param {HTMLElement} menu - The dropdown menu element.
     * @param {NodeList} checkboxes - The checkboxes within the dropdown menu.
     * @param {string} defaultText - The default text to display when no options are selected.
     */
    const toggleDropdown = (dropdown, menu, checkboxes, defaultText) => {
        console.log(`Initializing dropdown for ${dropdown.id}`);
        dropdown.addEventListener("click", (event) => {
            event.preventDefault();
            const isVisible = menu.style.display === "block";
            closeAllDropdowns();
            menu.style.display = isVisible ? "none" : "block";
            updateDropdownText(dropdown, checkboxes, defaultText);
        });
    
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener("change", () => updateDropdownText(dropdown, checkboxes, defaultText));
        });
    };
    
    /**
     * Updates the dropdown button text based on selected checkboxes.
     * @param {HTMLElement} dropdown - The dropdown button element.
     * @param {NodeList} checkboxes - The checkboxes within the dropdown menu.
     * @param {string} defaultText - The default text to display when no options are selected.
     */
    const updateDropdownText = (dropdown, checkboxes, defaultText) => {
        const selectedItems = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        
        console.log(`Selected in ${dropdown.id}:`, selectedItems); // Debugging line
        
        dropdown.innerHTML = selectedItems.length > 0
            ? `${selectedItems.join(", ")} <span class="caret">&#9662;</span>`
            : `${defaultText} <span class="caret">&#9662;</span>`;
    };
    
    /**
     * Closes all dropdown menus.
     */
    const closeAllDropdowns = () => {
        [departmentFilterMenu, languageFilterMenu, languageMenu, patternMenu].forEach(menu => {
            menu.style.display = "none";
        });
    };
    
    /**
     * Retrieves selected values from a set of checkboxes.
     * @param {NodeList} checkboxes - The checkboxes to retrieve values from.
     * @returns {string} - Comma-separated string of selected values.
     */
    const getSelectedValues = (checkboxes) => {
        return Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value)
            .join(',');
    };
    
    /**
     * Resets all filters to their default state.
     */
    const resetFilters = () => {
        [departmentFilterCheckboxes, languageFilterCheckboxes].forEach(checkboxGroup => {
            checkboxGroup.forEach(cb => cb.checked = false);
        });
        filenameSearchInput.value = '';
        updateDropdownText(departmentFilterDropdown, departmentFilterCheckboxes, "Select Department");
        updateDropdownText(languageFilterDropdown, languageFilterCheckboxes, "Select Languages");
        updateDropdownText(languageDropdown, languageCheckboxes, "Select Languages");
        currentFilters = { department: '', language: '', filename: '' };
        currentPage = 1;
    };
    
    /**
     * Shows a temporary popup message for user feedback.
     * @param {string} message - The message to display in the popup.
     */
    const showPopup = (message = 'Copied!') => {
        popup.textContent = message;
        popup.classList.add('fade-in');
        popup.style.display = 'block';
        setTimeout(() => {
            popup.classList.remove('fade-in');
            popup.classList.add('fade-out');
            setTimeout(() => {
                popup.classList.remove('fade-out');
                popup.style.display = 'none';
            }, 500);
        }, 2000);
    };
    
    // ================================
    // Initialize Dropdowns
    // ================================
    
    // Department Filter Dropdown
    toggleDropdown(departmentFilterDropdown, departmentFilterMenu, departmentFilterCheckboxes, "Select Department");
    
    // Language Filter Dropdown
    toggleDropdown(languageFilterDropdown, languageFilterMenu, languageFilterCheckboxes, "Select Languages");
    
    // Language Dropdown in Upload Form
    toggleDropdown(languageDropdown, languageMenu, languageCheckboxes, "Select Languages");
    
    // Pattern Dropdown
    toggleDropdown(patternDropdown, patternMenu, patternCheckboxes, "Select Patterns");
    
    // Close all dropdowns when clicking outside
    document.addEventListener("click", (event) => {
        if (![departmentFilterDropdown, languageFilterDropdown, languageDropdown, patternDropdown].some(dropdown => dropdown.contains(event.target))) {
            closeAllDropdowns();
        }
    });
    
    // ================================
    // Fetch Recordings with Pagination and Filters
    // ================================
    
    /**
     * Fetches recordings from the server based on the current page and filters.
     * @param {number} page - The current page number.
     * @param {Object} filters - The current filter criteria.
     */
    const fetchRecordings = async (page = 1, filters = {}) => {
        try {
            const queryParams = new URLSearchParams({
                page,
                page_size: pageSize,
                department: filters.department,
                language: filters.language,
                filename: filters.filename
            });
    
            const response = await fetch(`/list-audio-files?${queryParams.toString()}`);
            if (!response.ok) throw new Error(`Error: ${response.statusText}`);
    
            const data = await response.json();
            renderRecordings(data.recordings);
            updatePaginationControls(data.has_previous, data.has_next);
        } catch (error) {
            console.error("Failed to fetch recordings:", error);
            recordingsList.innerHTML = "<li>Error loading recordings.</li>";
        }
    };
    
    /**
     * Renders the list of recordings in the UI.
     * @param {Array} recordings - The array of recording objects.
     */
    const renderRecordings = (recordings) => {
        recordingsList.innerHTML = recordings.length ? "" : "<li>No recordings found.</li>";
        recordings.forEach(file => {
            const listItem = document.createElement("li");
            listItem.dataset.id = file.id;
            listItem.innerHTML = `
                <div>
                    <strong>${file.original_filename}</strong> (${file.duration.toFixed(2)} seconds)
                    <br>
                    Department: ${file.department}, Language: ${file.language}
                </div>
                <button class="delete-button" data-id="${file.id}">Delete</button>
            `;
            // Event Listeners
            listItem.addEventListener("click", (e) => {
                if (!e.target.classList.contains('delete-button')) {
                    loadRecording(file.id);
                }
            });
            listItem.querySelector(".delete-button").addEventListener("click", (e) => {
                deleteRecording(e, file.id);
            });
            recordingsList.appendChild(listItem);
        });
    };
    
    /**
     * Updates the state of pagination buttons based on the availability of previous and next pages.
     * @param {boolean} hasPrev - Indicates if a previous page exists.
     * @param {boolean} hasNext - Indicates if a next page exists.
     */
    const updatePaginationControls = (hasPrev, hasNext) => {
        prevPageButton.disabled = !hasPrev;
        nextPageButton.disabled = !hasNext;
    };
    
    // Initial Fetch
    fetchRecordings(currentPage, currentFilters);
    
    // ================================
    // Pagination Controls
    // ================================
    
    prevPageButton.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            fetchRecordings(currentPage, currentFilters);
        }
    });
    
    nextPageButton.addEventListener("click", () => {
        currentPage++;
        fetchRecordings(currentPage, currentFilters);
    });
    
    // ================================
    // Filter Form Submission
    // ================================
    
    filterForm.addEventListener("submit", (event) => {
        event.preventDefault();
        currentPage = 1;
        currentFilters = {
            department: getSelectedValues(departmentFilterCheckboxes),
            language: getSelectedValues(languageFilterCheckboxes),
            filename: filenameSearchInput.value.trim()
        };
        fetchRecordings(currentPage, currentFilters);
    });
    
    // ================================
    // Clear Filters
    // ================================
    
    clearFiltersButton.addEventListener("click", () => {
        resetFilters();
        fetchRecordings(currentPage, currentFilters);
    });
    
    // ================================
    // Handle File Upload
    // ================================
    
    uploadForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const fileInput = audioFileInput;
        const createTranscript = createTranscriptCheckbox.checked;
        const department = departmentSelect.value;
        const selectedLanguages = getSelectedValues(languageCheckboxes).split(',').filter(Boolean);
    
        if (!fileInput.files.length) {
            alert("Please select a file to upload.");
            return;
        }
    
        const formData = new FormData();
        formData.append("file", fileInput.files[0]);
        formData.append("create_transcript", createTranscript);
        formData.append("department", department);
        formData.append("language", JSON.stringify(selectedLanguages));
    
        try {
            const response = await fetch("/upload", {
                method: "POST",
                body: formData
            });
    
            const data = await response.json();
            alert(data.message);
            fetchRecordings(currentPage, currentFilters);
            uploadForm.reset();
            resetDropdownTexts();
        } catch (error) {
            console.error("Error uploading file:", error);
            alert("Failed to upload the file. Please try again.");
        }
    });
    
    /**
     * Resets the dropdown texts to their default values.
     */
    const resetDropdownTexts = () => {
        updateDropdownText(departmentFilterDropdown, departmentFilterCheckboxes, "Select Department");
        updateDropdownText(languageFilterDropdown, languageFilterCheckboxes, "Select Languages");
        updateDropdownText(languageDropdown, languageCheckboxes, "Select Languages");
    };
    
    // ================================
    // Load a Recording and Its Transcript
    // ================================
    
    /**
     * Loads the selected recording and displays its transcript.
     * @param {string} id - The ID of the recording to load.
     */
    const loadRecording = async (id) => {
        try {
            const response = await fetch(`/get-audio-details/${id}`);
            if (!response.ok) throw new Error(`Error: ${response.statusText}`);
            const data = await response.json();
    
            audioSource.src = `/serve-audio/${id}`;
            audioPlayer.load();
            displayTranscript(data.transcript);
            patternSection.style.display = "block";
        } catch (error) {
            console.error('Error loading recording:', error);
            alert("Failed to load the recording.");
        }
    };
    
    // ================================
    // Delete a Recording
    // ================================
    
    /**
     * Deletes the selected recording.
     * @param {Event} event - The event object.
     * @param {string} id - The ID of the recording to delete.
     */
    const deleteRecording = async (event, id) => {
        event.stopPropagation();
        if (!confirm("Do you want to delete the audio file?")) return;
    
        try {
            const response = await fetch(`/delete-audio/${id}`, { method: "DELETE" });
            const data = await response.json();
            alert(data.message);
            fetchRecordings(currentPage, currentFilters);
        } catch (error) {
            console.error("Error deleting file:", error);
            alert("Failed to delete the file. Please try again.");
        }
    };
    
    // ================================
    // Display Transcript
    // ================================
    
    /**
     * Displays the transcript in the UI.
     * @param {string} transcript - The transcript text to display.
     */
    const displayTranscript = (transcript) => {
        transcriptSection.textContent = transcript || "No transcript available.";
        copyTranscriptButton.style.display = transcript ? "block" : "none";
    };
    
    // ================================
    // Copy Transcript Functionality
    // ================================
    
    copyTranscriptButton.addEventListener("click", async () => {
        const transcriptText = transcriptSection.textContent;
        if (!transcriptText || transcriptText === "No transcript available.") {
            alert("No transcript available to copy.");
            return;
        }
    
        try {
            await navigator.clipboard.writeText(transcriptText);
            copyTranscriptButton.innerHTML = '<i class="fas fa-check"></i>';
            copyTranscriptButton.style.backgroundColor = '#28a745';
            showPopup("Transcript copied!");
            setTimeout(() => {
                copyTranscriptButton.innerHTML = '<i class="fas fa-copy"></i>';
                copyTranscriptButton.style.backgroundColor = '';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            alert("Failed to copy transcript. Please try again.");
        }
    });
    
    // ================================
    // Generate Patterns
    // ================================
    
    generatePatternsButton.addEventListener("click", async () => {
        const transcript = transcriptSection.textContent;
        const selectedPatterns = Array.from(patternCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
    
        if (!transcript || !selectedPatterns.length) {
            alert("Please ensure there's a transcript and at least one pattern is selected.");
            return;
        }
    
        try {
            const response = await fetch("/generate-patterns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transcript, patterns: selectedPatterns }),
            });
    
            if (!response.ok) throw new Error(`Error: ${response.statusText}`);
    
            const data = await response.json();
            displayPatternResults(data.results);
        } catch (error) {
            console.error("Error generating patterns:", error);
            alert("Failed to generate patterns. Please try again.");
        }
    });
    
    /**
     * Displays the generated pattern results in the UI.
     * @param {Object} results - The pattern results to display.
     */
    const displayPatternResults = (results) => {
        patternResults.textContent = JSON.stringify(results, null, 2);
        patternResultsSection.style.display = "block";
    };
    
    // ================================
    // Copy Pattern Results Functionality
    // ================================
    
    copyPatternsButton.addEventListener("click", async () => {
        const patternResultsText = patternResults.textContent;
        if (!patternResultsText) {
            alert("No pattern results available to copy.");
            return;
        }
    
        try {
            await navigator.clipboard.writeText(patternResultsText);
            copyPatternsButton.innerHTML = '<i class="fas fa-check"></i>';
            copyPatternsButton.style.backgroundColor = '#28a745';
            showPopup("Pattern results copied!");
            setTimeout(() => {
                copyPatternsButton.innerHTML = '<i class="fas fa-copy"></i>';
                copyPatternsButton.style.backgroundColor = '';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy pattern results:', err);
            alert("Failed to copy pattern results. Please try again.");
        }
    });
});
