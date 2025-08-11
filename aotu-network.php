<?php
/**
 * Plugin Name: AOTU Network (CPT + Tax + REST)
 * Description: Custom Post Type "Network Nodes" with taxonomy "Kinds" and REST-exposed meta for the Archive of the Untamed.
 * Version: 1.0.0
 * Author: AOTU
 * License: GPL-2.0-or-later
 * Text Domain: aotu-network
 */

if (!defined('ABSPATH')) { exit; }

add_action('init', function () {
  // Register Custom Post Type: aotu_node
  register_post_type('aotu_node', [
    'label' => __('Network Nodes', 'aotu-network'),
    'labels' => [
      'name'          => __('Network Nodes', 'aotu-network'),
      'singular_name' => __('Network Node', 'aotu-network'),
      'add_new_item'  => __('Add Network Node', 'aotu-network'),
      'edit_item'     => __('Edit Network Node', 'aotu-network'),
    ],
    'public'             => true,
    'show_in_rest'       => true,
    'has_archive'        => true,
    'menu_position'      => 20,
    'menu_icon'          => 'dashicons-networking',
    'supports'           => ['title','editor','excerpt','thumbnail','custom-fields'],
    'rewrite'            => ['slug' => 'network', 'with_front' => true],
    'rest_base'          => 'aotu_node',
  ]);

  // Register Taxonomy: aotu_kind (Kinds)
  register_taxonomy('aotu_kind', 'aotu_node', [
    'label'        => __('Kinds', 'aotu-network'),
    'public'       => true,
    'show_in_rest' => true,
    'hierarchical' => false,
    'rewrite'      => ['slug' => 'kind'],
    'rest_base'    => 'aotu_kind',
  ]);

  // Meta fields exposed in REST API
  $metas = [
    'city'      => 'string',
    'country'   => 'string',
    'website'   => 'string',
    'instagram' => 'string',
    'email'     => 'string',
    'lat'       => 'number',
    'lng'       => 'number',
    'tags'      => 'string', // e.g., "forest, urban, legal"
  ];

  foreach ($metas as $key => $type) {
    register_post_meta('aotu_node', $key, [
      'type'          => $type,
      'single'        => true,
      'show_in_rest'  => true,
      'auth_callback' => '__return_true',
    ]);
  }
});
