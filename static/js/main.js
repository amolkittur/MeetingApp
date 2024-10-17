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

    filterForm.addEventListener("submit", function(event) {
        event.preventDefault();
        currentPage = 1; // Reset to first page when filters change
        currentFilters.department = departmentFilterInput.value.trim().toLowerCase();
        currentFilters.language = languageFilterInput.value.trim().toLowerCase();
        currentFilters.filename = filenameSearchInput.value.trim().toLowerCase();
        fetchRecordings(currentPage, currentFilters);
    });

    // Handle clear filters button
    clearFiltersButton.addEventListener("click", function() {
        departmentFilterInput.value = '';
        languageFilterInput.value = '';
        filenameSearchInput.value = '';
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
            fetchRecordings(currentPage);
        }
    });

    nextPageButton.addEventListener("click", () => {
        currentPage++;
        fetchRecordings(currentPage);
    });

    // Handle file upload
    uploadForm.addEventListener("submit", function(event) {
        event.preventDefault();
        const formData = new FormData();
        formData.append("file", document.getElementById("audio-file").files[0]);
        formData.append("create_transcript", document.getElementById("create-transcript").checked);
        formData.append("department", document.getElementById("department").value.toLowerCase());
        formData.append("language", document.getElementById("language").value.toLowerCase());
    
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

    // Load a recording and its transcript /get-transcript
    // Load a recording and its transcript
    function loadRecording(id) {
        fetch(`/get-audio-details/${id}`)
            .then(response => response.json())
            .then(data => {
                audioSource.src = `/serve-audio/${id}`;  // Use id instead of filename
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
                fetchRecordings(currentPage);
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

    // Delete a recording
    function deleteRecording(event, filename) {
        event.stopPropagation();
        const confirmed = confirm("Do you want to delete the audio file?");
        if (confirmed) {
            fetch(`/delete-audio/${filename}`, {
                method: "DELETE"
            })
            .then(response => response.json())
            .then(data => {
                alert(data.message);
                fetchRecordings(currentPage);
            })
            .catch(error => {
                console.error("Error deleting file:", error);
            });
        }
    }
});
