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
			             src="${hit.image_groups[0].images[0].dis_base_link}"
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
	var category = $suggestionsWrapper.data('category');	// category ID - for category page
	var searchQuery = $suggestionsWrapper.data('q');		// onload search query - for search page 
	var client = algoliasearch(appId, searchApiKey);
	
	var productsIndexId = $suggestionsWrapper.data('productsindexid');	// site index for products
	var algoliaIndex = client.initIndex(productsIndexId);
	
	var search = instantsearch({
	  indexName: productsIndexId,
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
	
	
	
	
	
	
	// Helper for the render function
	var renderIndexListItem = ({ indexId, hits }) => `
	  <li>
	    Index: ${indexId}
	    <ol>
	      ${hits
	        .map(
	          hit =>
	            `<li>${instantsearch.highlight({ attribute: 'name', hit })}</li>`
	        )
	        .join('')}
	    </ol>
	  </li>
	`;

	// Create the render function
	var renderAutocomplete = (renderOptions, isFirstRender) => {
	  var { indices, currentRefinement, refine, widgetParams } = renderOptions;

	  if (isFirstRender) {
	    var input = document.createElement('input');
	    var ul = document.createElement('ul');

	    input.addEventListener('input', event => {
	      refine(event.currentTarget.value);
	    });

	    widgetParams.container.appendChild(input);
	    widgetParams.container.appendChild(ul);
	  }

	  widgetParams.container.querySelector('input').value = currentRefinement;
	  widgetParams.container.querySelector('ul').innerHTML = indices
	    .map(renderIndexListItem)
	    .join('');
	};

	// Create the custom widget
	var customAutocomplete = instantsearch.connectors.connectAutocomplete(
	  renderAutocomplete
	);

	// Instantiate the custom widget
	search.addWidgets([
	  customAutocomplete({
	    container: document.querySelector('#suggestions-wrapper'),
	  })
	]);
	
	
	
	
	
	
	
	
	

	search.start();
	
	
	
});