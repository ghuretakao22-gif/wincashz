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
            }
        } finally {
            window.close();
        }
    })();
</script>
</body>
</html>
