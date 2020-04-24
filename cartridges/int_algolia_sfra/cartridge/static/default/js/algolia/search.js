function renderPrice(hit) {
	return `<div class="price">
				<span>
					<span class="sales">
						<span class="value" content="${hit.price.USD}">${hit.price.USD}</span>
					</span>
				</span>
			</div>`;
}

function renderTitle(hit) {
	return `<div class="pdp-link">
				<a class="link hit-name" href="${hit.url}">${hit.name}</a>
			</div>`;
}

function renderImage(hit) {
	return `<div class="image-container">
			    <a href="${hit.url}">
			        <img class="tile-image"
			             src="${hit.image_groups[0].images[0].link}"
			             alt="${hit.name}"
			             title="${hit.image_groups[0].images[0].title}"
			             />
			    </a>
	  		</div>`;
}

document.addEventListener('DOMContentLoaded', function () {
	var $suggestionsWrapper = $('#suggestions-wrapper'); 
	var appId = $suggestionsWrapper.data('appid');
	var searchApiKey = $suggestionsWrapper.data('searchapikey');
	var category = $suggestionsWrapper.data('category');
	var client = algoliasearch(appId, searchApiKey);
	var cateogryIndex = client.initIndex(category);
	
	var search = instantsearch({
	  indexName: 'staging__RefArch__products__en-US',
	  searchClient: client
	});
	
	search.addWidget(
	  instantsearch.widgets.searchBox({
		container: '#searchbox',
	  })
	);
	
	search.addWidget(
	  instantsearch.widgets.hits({
		container: '#algolia-products',
		templates: {
	  	item: function(hit) {
	  		return `<div class="col-6 col-sm-4">
		    	<div class="product" data-pid="${hit.objectID}">
			    	<div class="product-tile">`
				    	+ renderImage(hit) +
				  		`<div class="tile-body">`
				  			+ renderTitle(hit)
	  						+ renderPrice(hit) +
				  		`</div>
				  	</div>
				</div>
			</div>
	  	`},
		},
	  })
	);
	

	search.addWidget(
	  instantsearch.widgets.clearRefinements({
		container: '#clear-refinements',
	  })
	);

	search.start();
	
});