if (sessionStorage.getItem("libraryLoggedIn") !== "true") {
    window.location.href = "login.html";
}

const storageKeys = {
    books: "books",
    members: "libraryMembers",
    issued: "issuedBooks",
    returned: "returnedBooks"
};
const metricAnimationFrames = new WeakMap();

function readItems(key) {
    const savedItems = localStorage.getItem(key);
    if (savedItems === null) {
        return [];
    }

    const items = JSON.parse(savedItems);
    if (!Array.isArray(items)) {
        throw new TypeError(`Saved library data for "${key}" must be an array.`);
    }
    return items;
}

function saveItems(key, items) {
    localStorage.setItem(key, JSON.stringify(items));
}

function getRecordQuantity(record) {
    const quantity = Number(record.quantity);
    return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 1;
}

function migrateAvailableQuantities() {
    const migrationKey = "libraryAvailableQuantityMigrationV1";
    if (localStorage.getItem(migrationKey) === "complete") {
        return;
    }

    const books = readItems(storageKeys.books);
    const issued = readItems(storageKeys.issued);
    books.forEach(function (book) {
        const issuedCopies = issued.filter(function (record) {
            return record.bookId === book.id;
        }).reduce(function (total, record) {
            return total + getRecordQuantity(record);
        }, 0);
        book.quantity = Math.max(0, (Number(book.quantity) || 0) - issuedCopies);
    });
    saveItems(storageKeys.books, books);
    localStorage.setItem(migrationKey, "complete");
}

function escapeHtml(value) {
    return String(value).replace(/[&<>\'"]/g, function (character) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
        };
        return entities[character];
    });
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidMobileNumber(phone) {
    return /^\d{10}$/.test(phone);
}

function setTimeFields(prefix, time) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time || "");
    if (!match) {
        return;
    }

    const hour = Number(match[1]);
    const hour12 = hour % 12 || 12;
    document.getElementById(`${prefix}Hour`).value = hour12;
    document.getElementById(`${prefix}Minute`).value = match[2];
    document.getElementById(`${prefix}Period`).value = hour < 12 ? "AM" : "PM";
}

function getTimeValue(prefix) {
    const hourValue = document.getElementById(`${prefix}Hour`).value;
    const minuteValue = document.getElementById(`${prefix}Minute`).value;
    const period = document.getElementById(`${prefix}Period`).value;
    if (!hourValue && !minuteValue && !period) {
        return "";
    }
    if (!hourValue || !minuteValue || !period) {
        return null;
    }

    const hour12 = Number(hourValue);
    const minute = Number(minuteValue);
    if (!Number.isInteger(hour12) || hour12 < 1 || hour12 > 12
        || !Number.isInteger(minute) || minute < 0 || minute > 59) {
        return null;
    }

    const hour24 = (hour12 % 12) + (period === "PM" ? 12 : 0);
    return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function generateBookId() {
    const books = readItems(storageKeys.books);
    const maxNumber = books.reduce(function (highest, book) {
        const match = String(book.id).match(/(\d+)$/);
        const current = match ? Number(match[1]) : 0;
        return Math.max(highest, current);
    }, 0);

    return `BK-${String(maxNumber + 1).padStart(4, "0")}`;
}

function generateMemberId() {
    const members = readItems(storageKeys.members);
    const maxNumber = members.reduce(function (highest, member) {
        const match = String(member.id || "").match(/(\d+)$/);
        return Math.max(highest, match ? Number(match[1]) : 0);
    }, 0);

    return `ST-${String(maxNumber + 1).padStart(3, "0")}`;
}

function showSection(sectionId) {
    document.querySelectorAll(".management-section").forEach(function (section) {
        section.hidden = section.id !== sectionId;
    });

    document.querySelectorAll("[data-section]").forEach(function (link) {
        link.classList.toggle("active", link.dataset.section === sectionId);
    });

    const dashboardPage = document.querySelector(".dashboard-page");
    const isDashboard = sectionId === "dashboardSection";

    if (dashboardPage) dashboardPage.hidden = !isDashboard;
}

function renderList(elementId, items, emptyMessage, template) {
    const container = document.getElementById(elementId);

    if (!container) {
        return;
    }

    container.innerHTML = items.length
        ? items.map(template).join("")
        : `<p class="empty-state">${emptyMessage}</p>`;
}

function renderBooks() {
    const books = readItems(storageKeys.books);
    const searchInput = document.getElementById("bookSearch");
    const searchTerm = (searchInput ? searchInput.value : "").trim().toLowerCase();

    const filteredBooks = books.filter(function (book) {
        return !searchTerm || [book.id, book.title, book.author, book.category, book.publisher, book.year].some(function (value) {
            return String(value || "").toLowerCase().includes(searchTerm);
        });
    });

    const container = document.getElementById("booksList");
    if (!container) {
        return;
    }

    container.innerHTML = filteredBooks.length
        ? filteredBooks.map(function (book) {
            return `<tr><td class="select-column"><input type="checkbox" data-select-book="${escapeHtml(book.id)}" aria-label="Select ${escapeHtml(book.title)}"></td><td>${escapeHtml(book.id)}</td><td>${escapeHtml(book.title)}</td><td>${escapeHtml(book.author)}</td><td>${escapeHtml(book.category)}</td><td>${escapeHtml(book.publisher || "-")}</td><td>${escapeHtml(book.year || "-")}</td><td>${escapeHtml(Number(book.quantity) || 0)}</td><td class="table-actions"><button class="edit-btn" data-edit-book="${escapeHtml(book.id)}" type="button">Edit</button><button class="add-quantity-btn" data-add-quantity="${escapeHtml(book.id)}" type="button">Add Qty</button><button class="delete-btn" data-delete-book="${escapeHtml(book.id)}" type="button">Delete</button></td></tr>`;
        }).join("")
        : `<tr><td class="empty-table" colspan="9">${searchTerm ? "No matching books found." : "No books added yet."}</td></tr>`;

    updateBookSelection();
}

function resetBookForm() {
    const form = document.getElementById("bookForm");
    if (!form) return;
    form.reset();
    document.getElementById("bookId").disabled = false;
    document.getElementById("bookSubmitButton").textContent = "Add Book";
    form.dataset.editingId = "";
    document.getElementById("bookModalTitle").textContent = "Add New Book";
    showFormMessage("bookMessage", "", false);
    closeBookModal();
}

function openBookModal() {
    const modal = document.getElementById("bookModal");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("bookTitle").focus();
}

function closeBookModal() {
    const modal = document.getElementById("bookModal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
}

function startBookEdit(bookId) {
    const book = readItems(storageKeys.books).find(function (item) {
        return item.id === bookId;
    });

    if (!book) {
        return;
    }

    document.getElementById("bookId").value = book.id;
    document.getElementById("bookId").disabled = true;
    document.getElementById("bookTitle").value = book.title || "";
    document.getElementById("bookAuthor").value = book.author || "";
    document.getElementById("bookCategory").value = book.category || "";
    document.getElementById("bookPublisher").value = book.publisher || "";
    document.getElementById("bookYear").value = book.year || "";
    document.getElementById("bookQuantity").value = book.quantity ?? "";
    document.getElementById("bookSubmitButton").textContent = "Save Changes";
    document.getElementById("bookModalTitle").textContent = "Edit Book";
    const form = document.getElementById("bookForm");
    form.dataset.editingId = book.id;
    showFormMessage("bookMessage", "", false);
    openBookModal();
}

function updateBookSelection() {
    const checkboxes = Array.from(document.querySelectorAll("[data-select-book]"));
    const selectedCount = checkboxes.filter(function (checkbox) {
        return checkbox.checked;
    }).length;
    const allSelected = checkboxes.length > 0 && selectedCount === checkboxes.length;
    const selectAll = document.getElementById("selectAllBooks");
    const headerSelectAll = document.getElementById("booksHeaderSelectAll");
    const count = document.getElementById("bookSelectionCount");

    if (selectAll) selectAll.checked = allSelected;
    if (headerSelectAll) headerSelectAll.checked = allSelected;
    if (count) count.textContent = `${selectedCount} books selected`;
}

function setVisibleBooksSelected(checked) {
    document.querySelectorAll("[data-select-book]").forEach(function (checkbox) {
        checkbox.checked = checked;
    });
    updateBookSelection();
}

function deleteSelectedBooks() {
    const selectedIds = Array.from(document.querySelectorAll("[data-select-book]:checked")).map(function (checkbox) {
        return checkbox.dataset.selectBook;
    });

    if (selectedIds.length === 0) {
        window.alert("Select at least one book to delete.");
        return;
    }

    const issued = readItems(storageKeys.issued);
    if (selectedIds.some(function (bookId) {
        return issued.some(function (record) {
            return record.bookId === bookId;
        });
    })) {
        window.alert("Return selected issued books before deleting them.");
        return;
    }

    if (!window.confirm(`Delete ${selectedIds.length} selected book${selectedIds.length === 1 ? "" : "s"}?`)) {
        return;
    }

    const selected = new Set(selectedIds);
    saveItems(storageKeys.books, readItems(storageKeys.books).filter(function (book) {
        return !selected.has(book.id);
    }));
    refreshDashboard();
}

function addBookQuantity(bookId) {
    const books = readItems(storageKeys.books);
    const book = books.find(function (item) {
        return item.id === bookId;
    });

    if (!book) {
        return;
    }

    const quantityInput = window.prompt(`How many copies of "${book.title}" would you like to add?`);
    if (quantityInput === null) {
        return;
    }

    const addedQuantity = Number(quantityInput.trim());
    if (!Number.isSafeInteger(addedQuantity) || addedQuantity <= 0) {
        window.alert("Enter a whole number greater than zero.");
        return;
    }

    const currentQuantity = book.quantity == null ? 0 : Number(book.quantity);
    if (!Number.isSafeInteger(currentQuantity) || currentQuantity < 0
        || currentQuantity + addedQuantity > Number.MAX_SAFE_INTEGER) {
        window.alert("The resulting quantity is too large.");
        return;
    }

    book.quantity = currentQuantity + addedQuantity;
    saveItems(storageKeys.books, books);
    refreshDashboard();
}

function resetMemberForm() {
    const form = document.getElementById("memberForm");
    if (!form) {
        return;
    }

    form.reset();
    form.dataset.editingId = "";
    document.getElementById("memberSubmitButton").textContent = "Add Member";
    document.getElementById("memberModalTitle").textContent = "Add New Member";
    document.getElementById("memberId").disabled = false;
    showFormMessage("memberMessage", "", false);
    closeMemberModal();
}

function openMemberModal() {
    const modal = document.getElementById("memberModal");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("memberName").focus();
}

function closeMemberModal() {
    const modal = document.getElementById("memberModal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
}

function startMemberEdit(memberId) {
    const member = readItems(storageKeys.members).find(function (item) {
        return item.id === memberId;
    });

    if (!member) {
        return;
    }

    const form = document.getElementById("memberForm");
    if (!form) {
        return;
    }

    document.getElementById("memberId").value = member.id || "";
    document.getElementById("memberId").disabled = true;
    document.getElementById("memberName").value = member.name || "";
    document.getElementById("memberEmail").value = member.email || "";
    document.getElementById("memberPhone").value = member.phone || "";
    document.getElementById("memberSubmitButton").textContent = "Save Changes";
    document.getElementById("memberModalTitle").textContent = "Edit Member";
    form.dataset.editingId = member.id;
    showFormMessage("memberMessage", "", false);
    showFormMessage("memberStatusMessage", "", false);
    openMemberModal();
}

function renderMembers() {
    const members = readItems(storageKeys.members);
    const searchInput = document.getElementById("memberSearch");
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";
    
    const filteredMembers = members.filter(function (member) {
        return !searchTerm || [member.id, member.name].some(function (value) {
            return String(value || "").toLowerCase().includes(searchTerm);
        });
    });
    
    const container = document.getElementById("membersList");
    if (!container) return;

    container.innerHTML = filteredMembers.length
        ? filteredMembers.map(function (member) {
            return `<tr><td>${escapeHtml(member.id)}</td><td>${escapeHtml(member.name)}</td><td>${escapeHtml(member.email)}</td><td>${escapeHtml(member.phone)}</td><td class="table-actions"><button class="edit-btn" data-edit-member="${escapeHtml(member.id)}" type="button">Edit</button><button class="delete-btn" data-delete-member="${escapeHtml(member.id)}" type="button">Delete</button></td></tr>`;
        }).join("")
        : `<tr><td class="empty-table" colspan="5">${searchTerm ? "No matching members found." : "No members added yet."}</td></tr>`;
}

function updateSelects() {
    const books = readItems(storageKeys.books);
    const members = readItems(storageKeys.members);
    const issued = readItems(storageKeys.issued);
    
    const availableBooks = books.filter(function (book) {
        return Number(book.quantity || 0) > 0;
    });
    
    const bookSelect = document.getElementById("issueBook");
    const memberSelect = document.getElementById("issueMember");

    if (bookSelect) {
        bookSelect.innerHTML = `<option value="">${availableBooks.length ? "Select book" : "No books currently available"}</option>${availableBooks.map(function (book) {
            return `<option value="${escapeHtml(book.id)}">${escapeHtml(book.title)} (${Number(book.quantity || 0)} available)</option>`;
        }).join("")}`;
        updateIssueQuantity();
    }

    if (memberSelect) {
        memberSelect.innerHTML = `<option value="">Select member</option>${members.map(function (member) {
            return `<option value="${escapeHtml(member.id)}">${escapeHtml(member.name)}</option>`;
        }).join("")}`;
    }

}

function updateIssueQuantity() {
    const quantityInput = document.getElementById("issueQuantity");
    const bookSelect = document.getElementById("issueBook");
    if (!quantityInput || !bookSelect) return;

    const selectedBook = readItems(storageKeys.books).find(function (book) {
        return book.id === bookSelect.value;
    });
    const maxQuantity = selectedBook ? Number(selectedBook.quantity || 0) : 1;
    quantityInput.max = String(Math.max(1, maxQuantity));
    if (!selectedBook || Number(quantityInput.value) > maxQuantity || Number(quantityInput.value) < 1) {
        quantityInput.value = "1";
    }
}

function renderIssued() {
    const issued = readItems(storageKeys.issued);
    renderList("issuedList", issued, "No books are currently issued.", function (record) {
        return `<div class="data-row"><div><strong>${escapeHtml(record.bookTitle)}</strong><span>${escapeHtml(record.memberName)} · Issued ${escapeHtml(record.date)} · Due ${escapeHtml(record.returnDate || "-")}</span></div><button class="action-btn small-btn" data-return-book="${escapeHtml(record.id)}" type="button">Return</button></div>`;
    });
}

function renderReturnTable() {
    const tableBody = document.getElementById("returnTableBody");
    if (!tableBody) return;

    const issued = readItems(storageKeys.issued);
    if (!issued.length) {
        tableBody.innerHTML = `<tr><td class="return-empty" colspan="8">No issues found.</td></tr>`;
        return;
    }

    const today = getLocalDateString();
    tableBody.innerHTML = issued.map(function (record) {
        const dueDate = record.returnDate || "-";
        const isOverdue = dueDate !== "-" && dueDate < today;
        const status = isOverdue ? "Overdue" : "Issued";
        return `<tr>
            <td>${escapeHtml(record.id)}</td>
            <td>${escapeHtml(record.memberName)}</td>
            <td>${escapeHtml(record.bookTitle)}</td>
            <td>${getRecordQuantity(record)}</td>
            <td>${escapeHtml(record.date)}</td>
            <td>${escapeHtml(dueDate)}</td>
            <td><span class="return-status ${isOverdue ? "overdue" : ""}">${status}</span></td>
            <td><button class="action-btn small-btn return-action" data-return-book="${escapeHtml(record.id)}" type="button">Return</button></td>
        </tr>`;
    }).join("");
}

function renderBookReport() {
    const tableBody = document.getElementById("reportBooksList");
    if (!tableBody) return;

    const searchInput = document.getElementById("reportBookSearch");
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const books = readItems(storageKeys.books).filter(function (book) {
        return !searchTerm || [book.id, book.title, book.author, book.category].some(function (value) {
            return String(value || "").toLowerCase().includes(searchTerm);
        });
    });

    tableBody.innerHTML = books.length
        ? books.map(function (book) {
            return `<tr>
                <td>${escapeHtml(book.id)}</td>
                <td>${escapeHtml(book.title)}</td>
                <td>${escapeHtml(book.author)}</td>
                <td>${escapeHtml(book.category)}</td>
                <td>${Number(book.quantity) || 0}</td>
            </tr>`;
        }).join("")
        : `<tr><td class="report-empty" colspan="5">${searchTerm ? "No matching books found." : "No books added yet."}</td></tr>`;
}

function updateCounters() {
    const books = readItems(storageKeys.books);
    const issued = readItems(storageKeys.issued);
    const members = readItems(storageKeys.members);
    const counts = {
        bookCount: books.length,
        memberCount: members.length,
        issuedCount: issued.reduce(function (total, record) {
            return total + getRecordQuantity(record);
        }, 0),
        returnedCount: readItems(storageKeys.returned).reduce(function (total, record) {
            return total + getRecordQuantity(record);
        }, 0)
    };

    Object.keys(counts).forEach(function (id) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = counts[id];
        }
    });

    const availableCopies = books.reduce(function (total, book) {
        return total + Math.max(0, Number(book.quantity) || 0);
    }, 0);
    animateDashboardMetric("dashboardBookCount", counts.bookCount);
    animateDashboardMetric("dashboardMemberCount", counts.memberCount);
    animateDashboardMetric("dashboardIssuedCount", counts.issuedCount);
    animateDashboardMetric("dashboardAvailableCount", availableCopies);

    const reportsSummaryMarkup = `<div><strong>${counts.bookCount}</strong><span>Total Books</span></div><div><strong>${counts.memberCount}</strong><span>Total Members</span></div><div><strong>${counts.issuedCount}</strong><span>Issued Books</span></div><div><strong>${counts.returnedCount}</strong><span>Returned Books</span></div>`;
    const returnSummaryMarkup = `<div><strong>${counts.bookCount}</strong><span>Total Books</span></div><div><strong>${counts.memberCount}</strong><span>Total Members</span></div><div><strong>${availableCopies}</strong><span>Available Books</span></div><div><strong>${counts.issuedCount}</strong><span>Issued Books</span></div>`;
    const reportSummary = document.getElementById("reportSummary");
    if (reportSummary) reportSummary.innerHTML = reportsSummaryMarkup;
    const returnReportSummary = document.getElementById("returnReportSummary");
    if (returnReportSummary) returnReportSummary.innerHTML = returnSummaryMarkup;
}

function animateDashboardMetric(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) {
        return;
    }

    const target = Number(targetValue);
    if (!Number.isSafeInteger(target) || target < 0) {
        throw new TypeError(`Dashboard metric "${elementId}" must be a non-negative integer.`);
    }

    const activeFrame = metricAnimationFrames.get(element);
    if (activeFrame) {
        window.cancelAnimationFrame(activeFrame);
        metricAnimationFrames.delete(element);
    }

    const current = Number(element.textContent) || 0;
    if (current === target) {
        return;
    }

    const metricCard = element.closest(".metric-card");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
        element.textContent = String(target);
    } else {
        const duration = 650;
        const startTime = performance.now();
        function step(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            element.textContent = String(Math.round(current + (target - current) * easedProgress));
            if (progress < 1) {
                metricAnimationFrames.set(element, window.requestAnimationFrame(step));
            } else {
                metricAnimationFrames.delete(element);
            }
        }
        metricAnimationFrames.set(element, window.requestAnimationFrame(step));
    }

    if (metricCard && !reduceMotion) {
        metricCard.classList.remove("metric-updated");
        void metricCard.offsetWidth;
        metricCard.classList.add("metric-updated");
    }
}

function showFormMessage(elementId, message, isError) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = message;
    element.className = `form-message ${isError ? "error-message" : "success-message"}`;
}

function completeReturn(record, returnedDate) {
    if (!returnedDate || returnedDate < record.date) {
        showFormMessage("returnMessage", "Choose a return date on or after the issue date.", true);
        return false;
    }

    const books = readItems(storageKeys.books);
    const book = books.find(function (item) {
        return item.id === record.bookId;
    });

    if (!book) {
        showFormMessage("returnMessage", "The book record could not be found. Its quantity was not changed.", true);
        return false;
    }

    book.quantity = (Number(book.quantity) || 0) + getRecordQuantity(record);
    saveItems(storageKeys.books, books);
    saveItems(storageKeys.returned, readItems(storageKeys.returned).concat({
        ...record,
        returnedDate: returnedDate
    }));
    saveItems(storageKeys.issued, readItems(storageKeys.issued).filter(function (item) {
        return item.id !== record.id;
    }));
    refreshDashboard();
    showFormMessage("returnMessage", "Book returned successfully.", false);
    return true;
}

function refreshDashboard() {
    renderBooks();
    renderMembers();
    updateSelects();
    renderIssued();
    renderReturnTable();
    updateCounters();
    renderBookReport();
}

function seedSampleBooks() {
    const existingBooks = readItems(storageKeys.books);
    const sampleBooks = [
        {
            id: "BK-0001",
            title: "Clean Code",
            author: "Robert C. Martin",
            category: "Programming",
            publisher: "Prentice Hall",
            year: 2008,
            quantity: 5
        },
        {
            id: "BK-0002",
            title: "Python Crash Course",
            author: "Eric Matthes",
            category: "Programming",
            publisher: "No Starch Press",
            year: 2019,
            quantity: 6
        },
        {
            id: "BK-0003",
            title: "Head First Java",
            author: "Kathy Sierra",
            category: "Java",
            publisher: "O'Reilly Media",
            year: 2005,
            quantity: 3
        },
        {
            id: "BK-0004",
            title: "You Don't Know JS",
            author: "Kyle Simpson",
            category: "JavaScript",
            publisher: "O'Reilly Media",
            year: 2015,
            quantity: 5
        }
    ];

    if (existingBooks.length === 0) {
        saveItems(storageKeys.books, sampleBooks);
    }
}

function addKnownBookMetadata() {
    const knownMetadata = {
        "javascript: the good parts": {
            publisher: "O'Reilly Media",
            year: 2008
        },
        "you don't know js": {
            publisher: "O'Reilly Media",
            year: 2015
        },
        "python crash course": {
            publisher: "No Starch Press",
            year: 2015
        },
        "the pragmatic programmer": {
            publisher: "Addison-Wesley Professional",
            year: 1999
        }
    };
    const books = readItems(storageKeys.books);
    let changed = false;

    books.forEach(function (book) {
        const metadata = knownMetadata[String(book.title || "").trim().toLowerCase()];
        if (!metadata) {
            return;
        }

        if (!book.publisher) {
            book.publisher = metadata.publisher;
            changed = true;
        }
        if (!book.year) {
            book.year = metadata.year;
            changed = true;
        }
    });

    if (changed) {
        saveItems(storageKeys.books, books);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    if (sessionStorage.getItem("libraryLoggedIn") !== "true") {
        window.location.href = "login.html";
        return;
    }

    seedSampleBooks();
    addKnownBookMetadata();

    document.querySelectorAll("[data-section]").forEach(function (link) {
        link.addEventListener("click", function (event) {
            event.preventDefault();
            showSection(link.dataset.section);
        });
    });

    const bookForm = document.getElementById("bookForm");
    if (bookForm) {
        bookForm.addEventListener("submit", function (event) {
            event.preventDefault();
            const books = readItems(storageKeys.books);
            const message = document.getElementById("bookMessage");
            const editingId = event.target.dataset.editingId;
            const enteredBookId = document.getElementById("bookId").value.trim();
            const bookId = enteredBookId || generateBookId();
            const title = document.getElementById("bookTitle").value.trim();
            const publisher = document.getElementById("bookPublisher").value.trim();
            const year = Number(document.getElementById("bookYear").value);
            const quantity = Number(document.getElementById("bookQuantity").value);

            if (message) message.className = "form-message";

            if (!editingId && books.some(function (book) { return String(book.id).toLowerCase() === bookId.toLowerCase(); })) {
                if (message) {
                    message.textContent = "Book ID must be unique.";
                    message.classList.add("error-message");
                }
                return;
            }

            if (!title) {
                if (message) {
                    message.textContent = "Book name is required.";
                    message.classList.add("error-message");
                }
                return;
            }

            if (!publisher) {
                if (message) {
                    message.textContent = "Publisher name is required.";
                    message.classList.add("error-message");
                }
                return;
            }

            if (!Number.isInteger(year) || year <= 0) {
                if (message) {
                    message.textContent = "Year is required and must be greater than zero.";
                    message.classList.add("error-message");
                }
                return;
            }

            if (!Number.isInteger(quantity) || quantity <= 0) {
                if (message) {
                    message.textContent = "Quantity must be greater than zero.";
                    message.classList.add("error-message");
                }
                return;
            }

            const updatedBook = {
                id: editingId || bookId,
                title: title,
                author: document.getElementById("bookAuthor").value.trim(),
                category: document.getElementById("bookCategory").value.trim(),
                publisher: publisher,
                year: year,
                quantity: quantity
            };

            if (editingId) {
                const bookIndex = books.findIndex(function (book) { return book.id === editingId; });
                if (bookIndex !== -1) {
                    books[bookIndex] = updatedBook;
                }
            } else {
                books.push(updatedBook);
            }

            saveItems(storageKeys.books, books);

            if (editingId) {
                const issued = readItems(storageKeys.issued).map(function (record) {
                    return record.bookId === editingId ? { ...record, bookTitle: updatedBook.title } : record;
                });
                saveItems(storageKeys.issued, issued);
            }

            resetBookForm();
            if (message) {
                message.textContent = editingId ? "Book updated successfully." : "Book added successfully.";
                message.classList.add("success-message");
            }
            refreshDashboard();
        });
    }

    const memberForm = document.getElementById("memberForm");
    if (memberForm) {
        memberForm.addEventListener("submit", function (event) {
            event.preventDefault();
            const members = readItems(storageKeys.members);
            const editingId = event.target.dataset.editingId || "";
            const enteredMemberId = document.getElementById("memberId").value.trim();
            const memberId = enteredMemberId || (editingId || generateMemberId());
            const name = document.getElementById("memberName").value.trim();
            const email = document.getElementById("memberEmail").value.trim();
            const phone = document.getElementById("memberPhone").value.trim();

            showFormMessage("memberMessage", "", false);
            if (!memberId || !name || !email || !phone) {
                showFormMessage("memberMessage", "Please fill in all member fields.", true);
                return;
            }

            if (!isValidEmail(email)) {
                showFormMessage("memberMessage", "Please enter a valid email address.", true);
                return;
            }

            if (!isValidMobileNumber(phone)) {
                showFormMessage("memberMessage", "Mobile number must contain exactly 10 digits.", true);
                return;
            }

            if (members.some(function (member) {
                return member.id !== editingId && String(member.id).toLowerCase() === memberId.toLowerCase();
            })) {
                showFormMessage("memberMessage", "Member ID must be unique.", true);
                return;
            }

            if (editingId) {
                const memberIndex = members.findIndex(function (member) {
                    return member.id === editingId;
                });

                if (memberIndex === -1) {
                    showFormMessage("memberMessage", "This member could not be found.", true);
                    return;
                }

                const updatedMember = {
                    id: memberId,
                    name: name,
                    email: email,
                    phone: phone
                };
                members[memberIndex] = updatedMember;

                const issued = readItems(storageKeys.issued).map(function (record) {
                    return record.memberId === editingId
                        ? { ...record, memberId: memberId, memberName: name }
                        : record;
                });
                const returned = readItems(storageKeys.returned).map(function (record) {
                    return record.memberId === editingId
                        ? { ...record, memberId: memberId, memberName: name }
                        : record;
                });
                saveItems(storageKeys.issued, issued);
                saveItems(storageKeys.returned, returned);
            } else {
                members.push({
                    id: memberId,
                    name: name,
                    email: email,
                    phone: phone
                });
            }

            saveItems(storageKeys.members, members);
            resetMemberForm();
            refreshDashboard();
            showFormMessage("memberStatusMessage", editingId ? "Member updated successfully." : "Member added successfully.", false);
        });
    }

    const issueForm = document.getElementById("issueForm");
    if (issueForm) {
        issueForm.addEventListener("submit", function (event) {
            event.preventDefault();
            const books = readItems(storageKeys.books);
            const members = readItems(storageKeys.members);
            const issued = readItems(storageKeys.issued);
            const bookId = document.getElementById("issueBook").value;
            const memberId = document.getElementById("issueMember").value;
            const book = books.find(function (item) { return item.id === bookId; });
            const member = members.find(function (item) { return item.id === memberId; });
            const issueDate = document.getElementById("issueDate").value;
            const returnDate = document.getElementById("issueReturnDate").value;
            const quantity = Number(document.getElementById("issueQuantity").value);

            showFormMessage("issueMessage", "", false);

            if (!book || !member) {
                const hasAvailableBooks = books.some(function (item) {
                    return Number(item.quantity || 0) > 0;
                });
                showFormMessage("issueMessage", !hasAvailableBooks
                    ? "No books are currently available to issue."
                    : "Select a valid book and member.", true);
                return;
            }

            if (Number(book.quantity || 0) <= 0) {
                showFormMessage("issueMessage", "This book is unavailable right now.", true);
                return;
            }

            if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > Number(book.quantity || 0)) {
                showFormMessage("issueMessage", "Choose a quantity within the available copies.", true);
                return;
            }

            const memberLoanCount = issued.filter(function (record) {
                return record.memberId === member.id;
            }).reduce(function (total, record) {
                return total + getRecordQuantity(record);
            }, 0);
            const maxBooksPerMember = Number(settings.maxBooksPerMember);
            if (!Number.isSafeInteger(maxBooksPerMember) || maxBooksPerMember < 1) {
                showFormMessage("issueMessage", "Set a valid maximum books-per-member value in Settings before issuing books.", true);
                return;
            }
            if (memberLoanCount + quantity > maxBooksPerMember) {
                showFormMessage("issueMessage", `This member cannot have more than ${settings.maxBooksPerMember} books issued at a time.`, true);
                return;
            }

            const loanPeriodDays = Number(settings.loanPeriodDays);
            if (!Number.isSafeInteger(loanPeriodDays) || loanPeriodDays < 1) {
                showFormMessage("issueMessage", "Set a valid loan period in Settings before issuing books.", true);
                return;
            }

            if (!issueDate || !returnDate || returnDate < issueDate) {
                showFormMessage("issueMessage", "Choose a return date on or after the issue date.", true);
                return;
            }

            const issueTimestamp = Date.now();
            for (let copyIndex = 0; copyIndex < quantity; copyIndex += 1) {
                let issueId = `${issueTimestamp}-${copyIndex}`;
                let idSuffix = 1;
                while (issued.some(function (record) { return record.id === issueId; })) {
                    issueId = `${issueTimestamp}-${copyIndex}-${idSuffix}`;
                    idSuffix += 1;
                }
                issued.push({
                    id: issueId,
                    bookId: book.id,
                    bookTitle: book.title,
                    memberId: member.id,
                    memberName: member.name,
                    date: issueDate,
                    returnDate: returnDate
                });
            }
            book.quantity = Number(book.quantity) - quantity;
            saveItems(storageKeys.books, books);
            saveItems(storageKeys.issued, issued);
            event.target.reset();
            updateIssueQuantity();
            setDefaultDates(settings.loanPeriodDays);
            refreshDashboard();
            showFormMessage("issueMessage", quantity === 1
                ? "Book issued successfully."
                : `${quantity} copies issued successfully.`, false);
        });
    }

    let settings = {};
    try {
        settings = JSON.parse(localStorage.getItem("librarySettings") || "{}");
        if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
            throw new TypeError("Saved library settings must be an object.");
        }
    } catch (error) {
        showFormMessage("settingsMessage", "Saved settings could not be read. Default settings are being shown.", true);
    }
    const defaultSettings = {
        name: "Digital Library",
        email: "library@example.com",
        phone: "",
        address: "",
        loanPeriodDays: 14,
        maxBooksPerMember: 5,
        overdueFine: 1,
        openingTime: "",
        closingTime: ""
    };
    settings = { ...defaultSettings, ...settings };

    document.getElementById("libraryName").value = settings.name;
    document.getElementById("libraryEmail").value = settings.email;
    document.getElementById("libraryPhone").value = settings.phone;
    document.getElementById("libraryAddress").value = settings.address;
    document.getElementById("loanPeriodDays").value = settings.loanPeriodDays;
    document.getElementById("maxBooksPerMember").value = settings.maxBooksPerMember;
    document.getElementById("overdueFine").value = settings.overdueFine;
    setTimeFields("openingTime", settings.openingTime);
    setTimeFields("closingTime", settings.closingTime);

    const issueDateInput = document.getElementById("issueDate");
    const issueReturnDateInput = document.getElementById("issueReturnDate");
    if (issueDateInput && issueReturnDateInput) {
        issueDateInput.addEventListener("change", function () {
            if (issueDateInput.value) {
                issueReturnDateInput.value = getDateAfterDays(issueDateInput.value, settings.loanPeriodDays);
            }
        });
    }

    const settingsForm = document.getElementById("settingsForm");
    if (settingsForm) {
        settingsForm.addEventListener("submit", function (event) {
            event.preventDefault();
            const openingTime = getTimeValue("openingTime");
            const closingTime = getTimeValue("closingTime");
            if (openingTime === null || closingTime === null) {
                showFormMessage("settingsMessage", "Enter a valid hour, minute, and AM/PM for each time.", true);
                return;
            }

            settings = {
                name: document.getElementById("libraryName").value.trim(),
                email: document.getElementById("libraryEmail").value.trim(),
                phone: document.getElementById("libraryPhone").value.trim(),
                address: document.getElementById("libraryAddress").value.trim(),
                loanPeriodDays: Number(document.getElementById("loanPeriodDays").value),
                maxBooksPerMember: Number(document.getElementById("maxBooksPerMember").value),
                overdueFine: Number(document.getElementById("overdueFine").value),
                openingTime: openingTime,
                closingTime: closingTime
            };
            localStorage.setItem("librarySettings", JSON.stringify(settings));
            if (issueDateInput && issueDateInput.value && issueReturnDateInput) {
                issueReturnDateInput.value = getDateAfterDays(issueDateInput.value, settings.loanPeriodDays);
            }
            showFormMessage("settingsMessage", "Settings saved successfully.", false);
        });
    }

    const bookSearch = document.getElementById("bookSearch");
    if (bookSearch) bookSearch.addEventListener("input", renderBooks);

    const reportBookSearch = document.getElementById("reportBookSearch");
    if (reportBookSearch) reportBookSearch.addEventListener("input", renderBookReport);

    const showBookForm = document.getElementById("showBookForm");
    if (showBookForm) {
        showBookForm.addEventListener("click", function () {
            resetBookForm();
            openBookModal();
        });
    }

    const closeBookModalButton = document.getElementById("closeBookModal");
    if (closeBookModalButton) closeBookModalButton.addEventListener("click", resetBookForm);

    const bookModal = document.getElementById("bookModal");
    if (bookModal) {
        bookModal.addEventListener("click", function (event) {
            if (event.target === bookModal) resetBookForm();
        });
    }

    const showMemberForm = document.getElementById("showMemberForm");
    if (showMemberForm) {
        showMemberForm.addEventListener("click", function () {
            resetMemberForm();
            showFormMessage("memberStatusMessage", "", false);
            openMemberModal();
        });
    }

    const closeMemberModalButton = document.getElementById("closeMemberModal");
    if (closeMemberModalButton) closeMemberModalButton.addEventListener("click", resetMemberForm);

    const memberModal = document.getElementById("memberModal");
    if (memberModal) {
        memberModal.addEventListener("click", function (event) {
            if (event.target === memberModal) resetMemberForm();
        });
    }

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && bookModal && !bookModal.hidden) {
            resetBookForm();
        }
        if (event.key === "Escape" && memberModal && !memberModal.hidden) {
            resetMemberForm();
        }
    });

    const clearBookSearch = document.getElementById("clearBookSearch");
    if (clearBookSearch) {
        clearBookSearch.addEventListener("click", function () {
            if (bookSearch) {
                bookSearch.value = "";
                renderBooks();
                bookSearch.focus();
            }
        });
    }

    ["selectAllBooks", "booksHeaderSelectAll"].forEach(function (id) {
        const selectAll = document.getElementById(id);
        if (selectAll) {
            selectAll.addEventListener("change", function () {
                setVisibleBooksSelected(selectAll.checked);
            });
        }
    });

    const deleteSelectedButton = document.getElementById("deleteSelectedBooks");
    if (deleteSelectedButton) {
        deleteSelectedButton.addEventListener("click", deleteSelectedBooks);
    }

    const booksList = document.getElementById("booksList");
    if (booksList) {
        booksList.addEventListener("change", function (event) {
            if (event.target.matches("[data-select-book]")) {
                updateBookSelection();
            }
        });
    }

    const memberSearch = document.getElementById("memberSearch");
    if (memberSearch) memberSearch.addEventListener("input", renderMembers);

    const issueBookSelect = document.getElementById("issueBook");
    if (issueBookSelect) issueBookSelect.addEventListener("change", updateIssueQuantity);

    const cancelBookEdit = document.getElementById("cancelBookEdit");
    if (cancelBookEdit) cancelBookEdit.addEventListener("click", resetBookForm);

    const cancelMemberEdit = document.getElementById("cancelMemberEdit");
    if (cancelMemberEdit) cancelMemberEdit.addEventListener("click", resetMemberForm);

    document.addEventListener("click", function (event) {
        const button = event.target.closest("button");
        if (!button) {
            return;
        }
        const editBookId = button.dataset.editBook;
        const editMemberId = button.dataset.editMember;
        const addQuantityBookId = button.dataset.addQuantity;
        const deleteBookId = button.dataset.deleteBook;
        const deleteMemberId = button.dataset.deleteMember;
        const returnBookId = button.dataset.returnBook;

        if (editBookId) {
            startBookEdit(editBookId);
        }

        if (addQuantityBookId) {
            addBookQuantity(addQuantityBookId);
        }

        if (editMemberId) {
            startMemberEdit(editMemberId);
        }

        if (deleteBookId) {
            const book = readItems(storageKeys.books).find(function (item) { return item.id === deleteBookId; });
            if (readItems(storageKeys.issued).some(function (record) { return record.bookId === deleteBookId; })) {
                window.alert("Return this book before deleting its record.");
                return;
            }
            if (!book || !window.confirm(`Delete "${book.title}"?`)) {
                return;
            }
            saveItems(storageKeys.books, readItems(storageKeys.books).filter(function (item) { return item.id !== deleteBookId; }));
            refreshDashboard();
        }

        if (deleteMemberId) {
            const member = readItems(storageKeys.members).find(function (item) { return item.id === deleteMemberId; });
            if (readItems(storageKeys.issued).some(function (record) { return record.memberId === deleteMemberId; })) {
                window.alert("Return all books issued to this member before deleting their record.");
                return;
            }
            if (!member || !window.confirm(`Delete member "${member.name}"?`)) {
                return;
            }
            saveItems(storageKeys.members, readItems(storageKeys.members).filter(function (m) { return m.id !== deleteMemberId; }));
            refreshDashboard();
            showFormMessage("memberStatusMessage", "Member deleted successfully.", false);
        }

        if (returnBookId) {
            const issued = readItems(storageKeys.issued);
            const record = issued.find(function (item) { return item.id === returnBookId; });
            if (record && window.confirm(`Confirm return of "${record.bookTitle}" from ${record.memberName}?`)) {
                completeReturn(record, getLocalDateString());
            }
        }
    });

    migrateAvailableQuantities();
    refreshDashboard();
    setDefaultDates(settings.loanPeriodDays);

    const requestedSection = window.location.hash.replace("#", "");
    const validSections = [
        "dashboardSection",
        "booksSection",
        "membersSection",
        "issueSection",
        "returnSection",
        "reportsSection",
        "settingsSection",
        "aboutSection"
    ];
    showSection(validSections.includes(requestedSection) ? requestedSection : "dashboardSection");
});

function setDefaultDates(loanPeriodDays) {
    const today = getLocalDateString();
    const issueDateInput = document.getElementById("issueDate");
    const returnDateInput = document.getElementById("issueReturnDate");
    const loanDays = Number(loanPeriodDays);
    if (!Number.isSafeInteger(loanDays) || loanDays < 1) {
        showFormMessage("settingsMessage", "Loan period must be a whole number greater than zero.", true);
        return;
    }

    if (issueDateInput && !issueDateInput.value) {
        issueDateInput.value = today;
    }
    if (returnDateInput && !returnDateInput.value) {
        const issueDate = issueDateInput && issueDateInput.value ? issueDateInput.value : today;
        returnDateInput.value = getDateAfterDays(issueDate, loanDays);
    }
}

function getDateAfterDays(dateValue, days) {
    const dayCount = Number(days);
    if (!Number.isSafeInteger(dayCount) || dayCount < 1) {
        showFormMessage("settingsMessage", "Loan period must be a whole number greater than zero.", true);
        return "";
    }

    const parts = dateValue.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    date.setUTCDate(date.getUTCDate() + dayCount);
    return date.toISOString().slice(0, 10);
}

function getLocalDateString() {
    const date = new Date();
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().split("T")[0];
}

function logout() {
    sessionStorage.removeItem("libraryLoggedIn");
    window.location.replace("login.html");
}