<script lang="ts">
	const items = [
		{ name: 'Test', href: 'test' },
		{ name: 'Flex', href: 'flex' },
		{ name: 'Grid', href: 'grid' }
	];
</script>

<div class="h-full w(16rem) vbox gap(1rem) p(1rem)">
	{#each items as item}
		<a href={`docs/${item.href}`} class="p(0.5rem/1rem) font-size(1.2rem) bg(#f4f4f5) r(8px)"
			>{item.name}</a
		>
	{/each}
</div>
