<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google Authentication</title>
</head>
<body>
<script>
    (function () {
        const payload = @json($payload);
        const targetOrigin = @json($targetOrigin);

        try {
            if (window.opener && !window.opener.closed) {
                window.opener.postMessage({
                    source: 'google-auth',
                    type: 'google-auth-result',
                    payload,
                }, targetOrigin);
                window.close();
                return;
            }
        } catch (e) {}

        // Direct full-page redirect flow (same window)
        if (payload && payload.token) {
            try {
                localStorage.setItem('wincashz_token', payload.token);
            } catch (e) {}

            const user = payload.user || {};
            if (user.role === 'moderator') {
                window.location.href = targetOrigin + '/moderator';
            } else if (user.role === 'admin') {
                window.location.href = targetOrigin + '/admin';
            } else {
                window.location.href = targetOrigin + '/earn';
            }
        } else {
            const err = payload && payload.error ? encodeURIComponent(payload.error) : 'Google+sign+in+failed';
            window.location.href = targetOrigin + '/login?error=' + err;
        }
    })();
</script>
</body>
</html>
