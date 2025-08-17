<script>
    import { Plus, X } from "@lucide/svelte";

    let {
        username = $bindable(""),
        password = $bindable(""),
        onLogin,
    } = $props();

    let extraCredentials = $state([]);

    function handleKeyDown(e) {
        if (e.key === "Enter") {
            doLogin();
        }
    }

    function doLogin() {
        const extraCredentialsTuples = extraCredentials
            .filter((cred) => cred.username.trim() && cred.password.trim())
            .map((cred) => [cred.username.trim(), cred.password.trim()]);
        onLogin(username, password, extraCredentialsTuples);
    }

    function addExtraCredential() {
        extraCredentials = [
            ...extraCredentials,
            { username: "", password: "" },
        ];
    }

    function removeExtraCredential(index) {
        extraCredentials = extraCredentials.filter((_, i) => i !== index);
    }
</script>

<div id="login">
    <div>
        <h1>Trino Data Explorer</h1>
        <div class="logintitle">
            <h3>Login</h3>
        </div>
        <input
            type="text"
            placeholder="username"
            bind:value={username}
            onkeydown={handleKeyDown}
        />
        <input
            type="password"
            placeholder="Windows password"
            bind:value={password}
            onkeydown={handleKeyDown}
        />
        <button onclick={doLogin}>Login</button>

        <div class="extra-credentials">
            <h3>Extra Credentials</h3>
            {#each extraCredentials as credential, index}
                <div class="credential-pair">
                    <input
                        type="text"
                        placeholder="key"
                        bind:value={credential.username}
                        onkeydown={handleKeyDown}
                    />
                    <input
                        type="password"
                        placeholder="value"
                        bind:value={credential.password}
                        onkeydown={handleKeyDown}
                    />
                    <button
                        type="button"
                        onclick={() => removeExtraCredential(index)}
                        class="remove-btn"><X size="1em" /></button
                    >
                </div>
            {/each}
            <button type="button" onclick={addExtraCredential} class="add-btn"
                ><Plus size="1em" /></button
            >
        </div>
    </div>
</div>

<style>
    .logintitle {
        margin-bottom: 1em;
    }

    #login {
        margin-top: 3em;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .extra-credentials {
        margin-top: 2em;
        padding-top: 1em;
        border-top: 1px solid #ccc;
    }

    .extra-credentials h3 {
        margin-bottom: 1em;
        font-size: 18px;
        font-weight: bold;
    }

    .credential-pair {
        display: flex;
        gap: 0.5em;
        margin-bottom: 0.5em;
        align-items: center;
    }

    .credential-pair input {
        flex: 1;
    }

    .remove-btn {
        background: #ff4444;
        color: white;
        border: none;
        border-radius: 3px;
        width: 25px;
        height: 25px;
        cursor: pointer;
    }

    .remove-btn:hover {
        background: #cc0000;
    }

    .add-btn {
        background: #4caf50;
        color: white;
        border: none;
        width: 25px;
        height: 25px;
        border-radius: 3px;
        cursor: pointer;
        margin-top: 0.5em;
    }

    .add-btn:hover {
        background: #45a049;
    }
</style>
