<script>
    let { username = $bindable(""), password = $bindable(""), onLogin } = $props();

    function handleKeyDown(e) {
        if (e.key === "Enter") {
            doLogin();
        }
    }

    function doLogin() {
        onLogin(username, password);
    }
</script>

<div id="login">
    <div>
        <div class="logintitle">
            <span class="loginh1">Login</span>
            <span>&nbsp;&nbsp;(Windows)</span>
        </div>
        <input 
            type="text" 
            placeholder="username" 
            bind:value={username} 
            onkeydown={handleKeyDown}
        />
        <input
            type="password"
            placeholder="password"
            bind:value={password}
            onkeydown={handleKeyDown}
        />
        <button onclick={doLogin}>Login</button>
    </div>
</div>

<style>
    .logintitle {
        margin-bottom: 1em;
    }

    .loginh1 {
        padding-bottom: 0.5em;
        font-size: 30px;
        font-weight: bold;
    }

    #login {
        margin-top: 3em;
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>