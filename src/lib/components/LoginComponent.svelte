<script>
    export let username = "";
    export let password = "";
    export let onLogin;

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
            on:keydown={handleKeyDown}
        />
        <input
            type="password"
            placeholder="password"
            bind:value={password}
            on:keydown={handleKeyDown}
        />
        <button on:click={doLogin}>Login</button>
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