<script lang="ts">
	import '@wave.css';
	import UIVersion from '../screens/UIVersion.svelte';
	import '../style.css';
	import Navbar from 'src/lib/navbar.svelte';
</script>

<div class="grid-rows(auto/1fr/auto) min-h(100vh) h-full bg(white) relative">
	<Navbar />

	<main class="h-full">
		<slot />
	</main>

	<footer class="hbox justify-between items-center p(1rem/2rem)">
		<p class="opacity(50%)">&copy; {new Date().getFullYear()} WaveCSS</p>
	</footer>
</div>

<UIVersion />
