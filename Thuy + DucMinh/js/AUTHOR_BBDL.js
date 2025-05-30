async function fetchCategories() {
    try {
        const res = await fetch('http://localhost:3000/api/categories/', {
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) {
            const errorText = await res.text();
            console.error('Fetch categories error:', errorText);
            throw new Error(`HTTP error! Status: ${res.status} - ${errorText}`);
        }
        const data = await res.json();
        console.log('Categories API response:', data);
        return Array.isArray(data.categories) ? data.categories : [];
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
}

async function fetchLeagues() {
    try {
        const res = await fetch('http://localhost:3000/api/leagues/', {
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) {
            const errorText = await res.text();
            console.error('Fetch leagues error:', errorText);
            throw new Error(`HTTP error! Status: ${res.status} - ${errorText}`);
        }
        const data = await res.json();
        console.log('Leagues API response:', data);
        const leagues = Array.isArray(data) ? data : Array.isArray(data.leagues) ? data.leagues : [];
        // Preserve all fields, ensure _id and name are present
        const normalizedLeagues = leagues.map(league => ({
            _id: league._id || league.id,
            name: league.name || 'Unknown League',
            type: league.type || 'League',
            parentCategory: league.parentCategory || null,
            slug: league.slug || '',
            logo_url: league.logo_url || ''
        }));
        console.log('Normalized leagues:', normalizedLeagues);
        window.leagues = normalizedLeagues; // Assign to window.leagues
        return normalizedLeagues;
    } catch (error) {
        console.error('Error fetching leagues:', error);
        window.leagues = [];
        return [];
    }
}


document.addEventListener("DOMContentLoaded", function () {
    const API_BASE_URL = "http://localhost:3000";

    // Helper: Get cookie value
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // Helper: Decode JWT token with Unicode support
    function decodeJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(function (c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    })
                    .join('')
            );
            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('Error decoding JWT:', error);
            return null;
        }
    }

    // Helper: Format date from ISO string (e.g., "2025-04-20T10:07:58.676Z" to "20/04/2025")
    function formatDate(isoDate) {
        if (!isoDate) return 'N/A';
        const date = new Date(isoDate);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }); // Outputs "20/04/2025"
    }

    // Update user info display
    function updateAdminInfo(user) {
        document.getElementById('user-name').textContent = user.username || 'Unknown';
        document.getElementById('user-role').textContent = user.role ? user.role.toUpperCase() : 'Unknown';
        const profilePic = document.getElementById('profile-pic-upper');
        profilePic.src = user.avatar;
        profilePic.alt = `${user.username || 'User'}'s Avatar`;
    }

    async function getCurrentUser() {
        try {
            const token = getCookie("token");
            console.log('Token:', token);
            if (!token) {
                throw new Error("Không tìm thấy token, vui lòng đăng nhập!");
            }
    
            const payload = decodeJwt(token);
            if (!payload) {
                throw new Error("Token không hợp lệ!");
            }
    
            const { id, username, role, avatar } = payload;
            console.log('User ID:', id);
            console.log('User Name:', username);
            console.log('User Role:', role);
            console.log('User Avatar:', avatar);
            console.log('Full Payload:', payload);
    
            if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
                throw new Error("ID không hợp lệ, phải là ObjectId MongoDB!");
            }
    
            let userData = { id, username, role, avatar };
            try {
                const res = await fetch(`${API_BASE_URL}/api/users/${id}/?_t=${Date.now()}`, {
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${token.trim()}`
                    }
                });
    
                if (!res.ok) {
                    const errorText = await res.text();
                    console.warn('API Error:', errorText);
                    if (res.status === 403) {
                        console.warn('Permission denied for /api/users/:id/, using token data');
                        return userData;
                    } else if (res.status === 401) {
                        const errorData = JSON.parse(errorText);
                        if (errorData.error === "jwt expired") {
                            // Token expired, trigger logout via logout.js
                            const logoutLink = document.querySelector('li a#logout-link');
                            if (logoutLink) {
                                console.log('Token expired, triggering logout...');
                                logoutLink.click(); // Simulate click to trigger logout.js logic
                                return null; // Exit function to prevent further execution
                            } else {
                                console.error('Logout link not found, redirecting to login manually');
                                window.location.href = 'http://127.0.0.1:5500/Hi-Tech/Login.html';
                                return null;
                            }
                        } else {
                            throw new Error(`HTTP error! Status: ${res.status} - ${errorText}`);
                        }
                    }
                }
    
                const contentType = res.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Response is not JSON');
                }
    
                const data = await res.json();
                console.log('User API Response:', data);
                const user = data.user || data;
                userData = {
                    id,
                    username: user.username !== undefined ? user.username : username,
                    role: user.role !== undefined ? user.role : role,
                    avatar: user.avatar !== undefined ? user.avatar : avatar
                };
            } catch (apiError) {
                console.warn('Falling back to token data due to API error:', apiError);
                return userData;
            }
    
            return userData;
        } catch (error) {
            console.error('getCurrentUser Error:', error);
            throw error;
        }
    }

    // Fetch bookmarks for the user
    async function fetchBookmarks(userId, token) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/bookmarks/user/${userId}/`, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token.trim()}`
                }
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`HTTP error! Status: ${res.status} - ${errorText}`);
            }

            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Response is not JSON');
            }

            const data = await res.json();
            console.log('Bookmarks API Response:', data);
            return Array.isArray(data.data) ? data.data : [];
        } catch (error) {
            console.error('fetchBookmarks Error:', error);
            return [];
        }
    }

    // Delete a bookmark
    async function deleteBookmark(bookmarkId, token) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/bookmarks/${bookmarkId}/`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token.trim()}`
                }
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`HTTP error! Status: ${res.status} - ${errorText}`);
            }

            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await res.json();
                console.log('Delete Bookmark Response:', data);
                return data; // Optionally return the response data if needed
            }

            return { success: true }; // If no JSON response, assume success
        } catch (error) {
            console.error('deleteBookmark Error:', error);
            throw error;
        }
    }

    // Populate the table with bookmarks
    function populateBookmarksTable(bookmarks) {
        const tableBody = document.getElementById('table-body');
        tableBody.innerHTML = ''; // Clear the placeholder

        if (!Array.isArray(bookmarks)) {
            console.error('populateBookmarksTable Error: bookmarks is not an array:', bookmarks);
            tableBody.innerHTML = '<tr><td colspan="5">Lỗi: Dữ liệu bookmark không hợp lệ.</td></tr>';
            return;
        }

        if (bookmarks.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">Không có bài báo nào được lưu.</td></tr>';
            return;
        }

        bookmarks.forEach(bookmark => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${bookmark.ArticleID?.title || 'N/A'}</td>
                <td><img src="${bookmark.ArticleID?.thumbnail}" alt="Ảnh bài báo" style="max-width: 100px;"></td>
                <td>${bookmark.ArticleID?.CategoryID?.name || 'N/A'}</td>
                <td>${formatDate(bookmark.ArticleID?.created_at)}</td>
                <td>
                    <a href="../Quang/baichitiet/html/baichitiet.html?articleId=${bookmark.ArticleID?._id || ''}">
                        <i class="fa-regular fa-eye"></i>
                    </a>
                    <i></i>
                    <i class="fa-solid fa-trash-can" data-bookmark-id="${bookmark._id || ''}"></i>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Add event listeners for delete buttons
        document.querySelectorAll('.fa-trash-can').forEach(button => {
            button.addEventListener('click', async (event) => {
                const bookmarkId = event.target.getAttribute('data-bookmark-id');
                if (bookmarkId && confirm('Bạn có chắc chắn muốn xóa bài báo này khỏi danh sách đã lưu?')) {
                    try {
                        const token = getCookie("token");
                        if (!token) {
                            throw new Error("Không tìm thấy token, vui lòng đăng nhập lại!");
                        }
                        await deleteBookmark(bookmarkId, token);
                        alert('Xóa bookmark thành công!');
                        event.target.closest('tr').remove();
                    } catch (error) {
                        alert('Lỗi khi xóa bài báo: ' + error.message);
                    }
                }
            });
        });
    }

    // Initialize: Fetch user data and bookmarks
    async function initialize() {
            try {
                const token = getCookie("token");
            if (!token) {
                window.location.href = 'http://127.0.0.1:5500/Hi-Tech/Login.html'; // Redirect to login without alert
                return;
            }

            const user = await getCurrentUser();
            if (!user) return; // Exit if user is null (due to logout redirect)

            updateAdminInfo(user);

            // Fetch and display bookmarks
            const bookmarks = await fetchBookmarks(user.id, token);
            console.log('Bookmarks before passing to populateBookmarksTable:', bookmarks);
            populateBookmarksTable(bookmarks);
        } catch (error) {
            console.error('Initialize error:', error.message);
            if (!getCookie("token")) {
                window.location.href = 'http://127.0.0.1:5500/Hi-Tech/Login.html'; // Redirect if no token after error
            } else {
                document.getElementById('user-name').textContent = 'Lỗi tải dữ liệu';
                document.getElementById('user-role').textContent = 'Unknown';
                document.getElementById('table-body').innerHTML = '<tr><td colspan="5">Lỗi tải dữ liệu bài báo.</td></tr>';
            }
        }
    }

    initialize();
});