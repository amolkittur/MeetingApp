document.addEventListener("DOMContentLoaded", function() {
    const uploadForm = document.getElementById("upload-form");
    const recordingsList = document.getElementById("recordings-list");
    const audioPlayer = document.getElementById("audio-player");
    const audioSource = document.getElementById("audio-source");
    const transcriptSection = document.getElementById("transcript");
    const prevPageButton = document.getElementById("prev-page");
    const nextPageButton = document.getElementById("next-page");
    const copyTranscriptButton = document.getElementById("copy-transcript");
    const filterForm = document.getElementById("filter-form");
    const departmentFilterInput = document.getElementById("department-filter");
    const languageFilterInput = document.getElementById("language-filter");
    const filenameSearchInput = document.getElementById("filename-search");
    const clearFiltersButton = document.getElementById("clear-filters");
    let currentPage = 1;

    let currentFilters = {
        department: "",
        language: "",
        filename: ""
    };
    
    const pageSize = 5;

    // Create popup element
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.textContent = 'Transcript copied!';
    document.body.appendChild(popup);

    // Function to show and hide popup
    function showPopup() {
        popup.classList.add('fade-in');
        popup.style.display = 'block';
        setTimeout(() => {
            popup.classList.remove('fade-in');
            popup.classList.add('fade-out');
            setTimeout(() => {
                popup.classList.remove('fade-out');
                popup.style.display = 'none';
            }, 500); // Duration of fade-out
        }, 2000); // Display duration
    }

    const departmentFilterDropdown = document.getElementById("departmentFilterDropdown");
    const departmentFilterMenu = document.getElementById("departmentFilterMenu");
    const departmentFilterCheckboxes = departmentFilterMenu.querySelectorAll('input[type="checkbox"]');

    const languageFilterDropdown = document.getElementById("languageFilterDropdown");
    const languageFilterMenu = document.getElementById("languageFilterMenu");
    const languageFilterCheckboxes = languageFilterMenu.querySelectorAll('input[type="checkbox"]');

    // Function to toggle dropdown visibility
    function toggleDropdown(dropdown, menu, checkboxes) {
        dropdown.addEventListener("click", function(event) {
            event.preventDefault();
            if (menu.style.display === "block") {
                menu.style.display = "none";
                updateDropdownText(dropdown, checkboxes);
            } else {
                menu.style.display = "block";
            }
        });
    }

    // Function to update dropdown text
    function updateDropdownText(dropdown, checkboxes) {
        const selectedItems = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        
        dropdown.innerHTML = selectedItems.length > 0
            ? selectedItems.join(", ") + ' <span class="caret">&#9662;</span>'
            : 'Select ' + dropdown.textContent.split(' ')[1] + ' <span class="caret">&#9662;</span>';
    }

    // Set up dropdowns
    toggleDropdown(departmentFilterDropdown, departmentFilterMenu, departmentFilterCheckboxes);
    toggleDropdown(languageFilterDropdown, languageFilterMenu, languageFilterCheckboxes);

    // Close dropdowns when clicking outside
    document.addEventListener("click", function(event) {
        if (!departmentFilterDropdown.contains(event.target) && !departmentFilterMenu.contains(event.target)) {
            departmentFilterMenu.style.display = "none";
            updateDropdownText(departmentFilterDropdown, departmentFilterCheckboxes);
        }
        if (!languageFilterDropdown.contains(event.target) && !languageFilterMenu.contains(event.target)) {
            languageFilterMenu.style.display = "none";
            updateDropdownText(languageFilterDropdown, languageFilterCheckboxes);
        }
    });

    // Update dropdown text when checkboxes change
    departmentFilterCheckboxes.forEach(checkbox => {
        checkbox.addEventListener("change", () => updateDropdownText(departmentFilterDropdown, departmentFilterCheckboxes));
    });

    languageFilterCheckboxes.forEach(checkbox => {
        checkbox.addEventListener("change", () => updateDropdownText(languageFilterDropdown, languageFilterCheckboxes));
    });

    // Modify the filter form submission
    filterForm.addEventListener("submit", function(event) {
        event.preventDefault();
        currentPage = 1; // Reset to first page when filters change
        currentFilters.department = Array.from(departmentFilterCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value)
            .join(',');
        currentFilters.language = Array.from(languageFilterCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value)
            .join(',');
        currentFilters.filename = filenameSearchInput.value;
        fetchRecordings(currentPage, currentFilters);
    });

    // Handle clear filters button
    clearFiltersButton.addEventListener("click", function() {
        departmentFilterCheckboxes.forEach(cb => cb.checked = false);
        languageFilterCheckboxes.forEach(cb => cb.checked = false);
        filenameSearchInput.value = '';
        updateDropdownText(departmentFilterDropdown, departmentFilterCheckboxes);
        updateDropdownText(languageFilterDropdown, languageFilterCheckboxes);
        currentFilters = { department: '', language: '', filename: '' };
        currentPage = 1;
        fetchRecordings(currentPage, currentFilters);
    });

    // Fetch recordings with pagination
    function fetchRecordings(page, filters = {}) {
        let url = `/list-audio-files?page=${page}&page_size=${pageSize}`;
        if (filters.department) {
            url += `&department=${encodeURIComponent(filters.department)}`;
        }
        if (filters.language) {
            url += `&language=${encodeURIComponent(filters.language)}`;
        }
        if (filters.filename) {
            url += `&filename=${encodeURIComponent(filters.filename)}`;
        }

        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.recordings.length === 0) {
                    recordingsList.innerHTML = "<li>No recordings found.</li>";
                } else {
                    recordingsList.innerHTML = "";
                    data.recordings.forEach(file => {
                        const listItem = document.createElement("li");
                        listItem.innerHTML = `
                            <div>
                                <strong>${file.original_filename}</strong> (${file.duration.toFixed(2)} seconds)
                                <br>
                                Department: ${file.department}, Language: ${file.language}
                            </div>
                            <button class="delete-button" data-id="${file.id}">Delete</button>
                        `;
                        listItem.dataset.id = file.id;
                        listItem.querySelector(".delete-button").addEventListener("click", (e) => deleteRecording(e, file.id));
                        listItem.addEventListener("click", () => loadRecording(file.id));
                        recordingsList.appendChild(listItem);
                    });
                }
                prevPageButton.disabled = !data.has_previous;
                nextPageButton.disabled = !data.has_next;
            });
    }

    // Initial fetch
    fetchRecordings(currentPage, currentFilters);

    // Pagination controls
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

    // Handle file upload
    uploadForm.addEventListener("submit", function(event) {
        event.preventDefault();
        const formData = new FormData();
        formData.append("file", document.getElementById("audio-file").files[0]);
        formData.append("create_transcript", document.getElementById("create-transcript").checked);
        formData.append("department", document.getElementById("department").value);
        
        // Append selected languages as a list
        const selectedLanguages = Array.from(languageCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        formData.append("language", JSON.stringify(selectedLanguages));

        fetch("/upload", {
            method: "POST",
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            location.reload();
        })
        .catch(error => {
            console.error("Error uploading file:", error);
        });
    });    

    // Load a recording and its transcript
    function loadRecording(id) {
        console.log(`Loading recording with id: ${id}`); // Debugging
        fetch(`/get-audio-details/${id}`)
            .then(response => response.json())
            .then(data => {
                console.log(`Fetched audio details:`, data); // Debugging
                audioSource.src = `/serve-audio/${id}`;
                audioPlayer.load();
                displayTranscript(data.transcript);
            })
            .catch(error => {
                console.error('Error loading recording:', error);
            });
    }    

    // Delete a recording
    function deleteRecording(event, id) {
        event.stopPropagation();
        const confirmed = confirm("Do you want to delete the audio file?");
        if (confirmed) {
            fetch(`/delete-audio/${id}`, {
                method: "DELETE"
            })
            .then(response => response.json())
            .then(data => {
                alert(data.message);
                fetchRecordings(currentPage, currentFilters);
            })
            .catch(error => {
                console.error("Error deleting file:", error);
            });
        }
    }    

    function displayTranscript(transcript) {
        transcriptSection.textContent = transcript;
        copyTranscriptButton.style.display = transcript ? "block" : "none";
    }

    // Copy transcript functionality
    copyTranscriptButton.addEventListener("click", function() {
        const transcriptText = transcriptSection.innerText;
        if (transcriptText) {
            navigator.clipboard.writeText(transcriptText).then(() => {
                // Visual feedback when copied
                copyTranscriptButton.innerHTML = '<i class="fas fa-check"></i>';
                copyTranscriptButton.style.backgroundColor = '#28a745';
                showPopup();
                setTimeout(() => {
                    copyTranscriptButton.innerHTML = '<i class="fas fa-copy"></i>';
                    copyTranscriptButton.style.backgroundColor = '';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy: ', err);
                alert("Failed to copy transcript. Please try again.");
            });
        } else {
            alert("No transcript available to copy.");
        }
    });

    const languageDropdown = document.getElementById("languageDropdown");
    const languageMenu = document.getElementById("languageMenu");
    const languageCheckboxes = languageMenu.querySelectorAll('input[type="checkbox"]');

    // Toggle dropdown menu
    languageDropdown.addEventListener("click", function(event) {
        event.preventDefault();
        languageMenu.style.display = languageMenu.style.display === "block" ? "none" : "block";
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", function(event) {
        if (!languageDropdown.contains(event.target) && !languageMenu.contains(event.target)) {
            languageMenu.style.display = "none";
        }
    });

    // Update dropdown button text
    function updateDropdownText() {
        const selectedLanguages = Array.from(languageCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        
        languageDropdown.innerHTML = selectedLanguages.length > 0
            ? selectedLanguages.join(", ") + ' <span class="caret">&#9662;</span>'
            : 'Select Languages <span class="caret">&#9662;</span>';
    }

    languageCheckboxes.forEach(checkbox => {
        checkbox.addEventListener("change", updateDropdownText);
    });
});
