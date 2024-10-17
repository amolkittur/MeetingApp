document.addEventListener("DOMContentLoaded", function() {
    const uploadForm = document.getElementById("upload-form");
    const recordingsList = document.getElementById("recordings-list");
    const audioPlayer = document.getElementById("audio-player");
    const audioSource = document.getElementById("audio-source");
    const transcriptSection = document.getElementById("transcript");
    const prevPageButton = document.getElementById("prev-page");
    const nextPageButton = document.getElementById("next-page");
    let currentPage = 1;
    const pageSize = 5;
    let transcriptData = [];

    const copyTranscriptButton = document.getElementById("copy-transcript");

    // Create popup element
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.textContent = 'Content copied!';
    document.body.appendChild(popup);

    // Function to show popup
    function showPopup() {
        popup.style.display = 'block';
        setTimeout(() => {
            popup.style.display = 'none';
        }, 2000);
    }

    // Fetch available recordings with pagination
    function fetchRecordings(page) {
        fetch(`/list-audio-files?page=${page}&page_size=${pageSize}`)
            .then(response => response.json())
            .then(data => {
                recordingsList.innerHTML = "";
                data.recordings.forEach(file => {
                    const listItem = document.createElement("li");
                    listItem.innerHTML = `${file.filename} (${file.duration.toFixed(2)} seconds) <button class="delete-button" data-filename="${file.filename}">Delete</button>`;
                    listItem.dataset.filename = file.filename;
                    listItem.querySelector(".delete-button").addEventListener("click", (e) => deleteRecording(e, file.filename));
                    listItem.addEventListener("click", () => loadRecording(file.filename));
                    recordingsList.appendChild(listItem);
                });
                prevPageButton.disabled = !data.has_previous;
                nextPageButton.disabled = !data.has_next;
            });
    }

    // Initial fetch
    fetchRecordings(currentPage);

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
    function loadRecording(filename) {
        audioSource.src = `/serve-audio/${filename}`;
        audioPlayer.load();

        fetch(`/get-transcript/${filename}`)
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error('Transcript not available');
                }
            })
            .then(data => {
                displayTranscript(data.transcript);
            })
            .catch(error => {
                console.error('Error loading transcript:', error);
                transcriptSection.textContent = "Transcript not available.";
            });
    }

    function displayTranscript(transcript) {
        transcriptSection.textContent = transcript;
        copyTranscriptButton.style.display = transcript ? "block" : "none";
    }

    // Add copy functionality
    copyTranscriptButton.addEventListener("click", function() {
        const transcriptText = transcriptSection.textContent;
        if (transcriptText) {
            navigator.clipboard.writeText(transcriptText).then(() => {
                // Visual feedback
                copyTranscriptButton.innerHTML = '<i class="fas fa-check"></i>';
                copyTranscriptButton.style.backgroundColor = '#28a745';
                showPopup(); // Show the popup
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
        const confirmed = confirm("Do you want to delete the audio file? Yes or No");
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
